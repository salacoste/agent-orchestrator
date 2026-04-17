# Story 57.13: Story Quick Actions

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to perform quick actions on stories via Telegram**,
so that **I can make updates without switching contexts**.

## Acceptance Criteria

1. **Given** I receive a message about a story
   **When** I view the notification message
   **Then** I see inline buttons for quick actions: [Block], [Priority], [Assign]
   **And** each button triggers a single-tap action or a simple follow-up

2. **Given** I tap [Block] on a story notification
   **When** the callback is processed
   **Then** the story status is set to "blocked"
   **And** the message updates to show "Story <id> blocked"
   **And** the status change is persisted via the sprint story API

3. **Given** I tap [Priority] on a story notification
   **When** the callback is processed
   **Then** the bot shows a follow-up with priority options: [High] [Normal] [Low]
   **And** tapping a priority level updates the story urgency
   **And** the message updates to show the new priority

4. **Given** I tap [Assign] on a story notification
   **When** the callback is processed
   **Then** the bot shows available agents for the project
   **And** tapping an agent name assigns the story to that agent
   **And** the message updates to show "Assigned to <agent>"

5. **Given** a quick action callback fires for an already-processed action
   **When** the callback is processed
   **Then** the bot answers with "Already processed" (idempotency via existing mechanism)

6. **Given** a quick action handler encounters an error
   **When** the action fails (e.g., agent unavailable, story not found)
   **Then** the message updates to show the error
   **And** `answerCallbackQuery` is still called (prevents Telegram "clock" icon)

## Tasks / Subtasks

- [ ] Task 1: Extend CallbackAction type and add story action constants (AC: #1)
  - [ ] 1.1: Update `CallbackAction` type in `telegram-bot.ts` to add `"block"`, `"unblock"`, `"priority"`, `"assign"` actions
  - [ ] 1.2: Add `"block"`, `"unblock"`, `"priority"`, `"assign"` to `VALID_CALLBACK_ACTIONS` set
  - [ ] 1.3: Verify existing encode/decode round-trip with new action strings

- [ ] Task 2: Create `buildStoryActionButtons()` helper (AC: #1)
  - [ ] 2.1: Create `buildStoryActionButtons(storyId: string, projectKey: string, dashboardBaseUrl?: string): InlineKeyboardButton[][] | undefined` in `telegram-bot.ts`
  - [ ] 2.2: Return buttons: `[Block] [Priority] [Assign]` — each with `encodeCallbackData()` using storyId as targetId
  - [ ] 2.3: Guard empty storyId — return `undefined`
  - [ ] 2.4: Export from `telegram-bot.ts` and `index.ts`

- [ ] Task 3: Add `formatStoryActionMessage()` helper (AC: #2, #3, #4)
  - [ ] 3.1: Create `formatStoryActionMessage(storyId: string, project: string, action: string, result: string): string` for action result messages
  - [ ] 3.2: Escape all dynamic content with `escapeMarkdownV2()`
  - [ ] 3.3: Export from `telegram-bot.ts` and `index.ts`

- [ ] Task 4: Create story action handler factories in webhook route (AC: #2, #3, #4, #6)
  - [ ] 4.1: Create `createBlockHandler()` that calls `PATCH /api/sprint/{project}/story/{id}` with `{ status: "blocked" }` via internal service call or direct StateManager
  - [ ] 4.2: Create `createUnblockHandler()` that sets status back to "in-progress"
  - [ ] 4.3: Create `createPriorityHandler()` that updates story urgency via StateManager
  - [ ] 4.4: Create `createAssignHandler()` that triggers agent assignment via cross-project assignment service
  - [ ] 4.5: Wire all new handlers in `getBot()` via `registerCallbackHandler`
  - [ ] 4.6: Handle errors with user-friendly messages per AC #6

- [ ] Task 5: Integrate story action buttons into notification flow (AC: #1)
  - [ ] 5.1: In `notification-plugin.ts`: detect `story.*` event types that should show quick actions
  - [ ] 5.2: For story events: call `buildStoryActionButtons()` with story ID from event metadata
  - [ ] 5.3: Ensure story action buttons are appended to existing notification buttons (or replace for story-specific notifications)

- [ ] Task 6: Add tests (AC: all)
  - [ ] 6.1: Test `buildStoryActionButtons()` returns correct buttons with valid callback data
  - [ ] 6.2: Test `buildStoryActionButtons()` returns `undefined` for empty storyId
  - [ ] 6.3: Test `formatStoryActionMessage()` escapes dynamic content
  - [ ] 6.4: Test block handler calls API and returns success text
  - [ ] 6.5: Test unblock handler calls API and returns success text
  - [ ] 6.6: Test priority handler updates urgency and returns confirmation
  - [ ] 6.7: Test assign handler triggers assignment and returns confirmation
  - [ ] 6.8: Test error handling for each handler (API failure, not found)
  - [ ] 6.9: Test idempotency: second tap returns "Already processed"
  - [ ] 6.10: Test callback data for new actions stays under 64 bytes
  - [ ] 6.11: Test notification-plugin includes story action buttons for relevant events
  - [ ] 6.12: Run full test suite — 0 regressions

- [ ] Task 7: Update sprint-status.yaml

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
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
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
- `CallbackAction` type — EXTENDING: add `"block"` | `"unblock"` | `"priority"` | `"assign"` (currently `"resume" | "dismiss" | "view" | "approve" | "deny"`)
- `encodeCallbackData()` / `decodeCallbackData()` — EXISTING: already generic, works with any action string
- `registerCallbackHandler()` — EXISTING: accepts `Partial<Record<CallbackAction, Handler>>`
- `StateManager.update(storyId, updates)` — EXISTING: from `@composio/ao-core`, can update `status` and `urgency`
- `StateManager.get(storyId)` — EXISTING: reads current story state
- `AgentRegistry` — EXISTING: from `@composio/ao-core`, tracks agent assignments
- `SessionManager.spawn(config)` — EXISTING: for spawning agents to assigned stories
- `writeStoryStatus(project, storyId, status)` — EXISTING: from `@composio/ao-plugin-tracker-bmad`
- `PATCH /api/sprint/{project}/story/{id}` — EXISTING: web API route for status changes
- `GET /api/sprint/{project}/assignable-agents` — EXISTING: web API route listing available agents
- `sendWithRetry()` — EXISTING: from `./send-helpers.js`
- `escapeMarkdownV2()` — EXISTING: from `./markdown-escape.js`
- `buildNotificationButtons()` — EXISTING: pattern to follow for `buildStoryActionButtons()`

**Feature Flags:**
- None expected — all required interfaces exist in core and web packages.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — StateManager, AgentRegistry, SessionManager)
- `@composio/ao-plugin-tracker-bmad` (workspace dependency — writeStoryStatus, appendHistory)
- `grammy` (already reviewed in Story 57-1, approved: MIT)

## Dev Notes

### Architecture Context

This is **Story 13 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1 through 57-12** (all done).

**Dependency chain:** Stories 57-1 through 57-12 (done) → **Story 57-13 (this story)** → Stories 57-14, 57-15

### What This Story Actually Does

**The problem:** When a project manager receives a Telegram notification about a story (blocked, new assignment, status change), they currently need to open the dashboard to take any action. This is inconvenient on mobile and adds latency to decisions.

**The solution:** Add inline action buttons to story-related notifications so the PM can block/unblock, change priority, and assign agents directly from Telegram with one or two taps.

**What this does NOT do:**
- Multi-step conversations (Story 57-14)
- Notification deduplication (Story 57-15)
- Creating new stories from Telegram
- Full story editing (only quick actions)

### Key Design Decisions

1. **CallbackAction extension is additive**: Add `"block"`, `"unblock"`, `"priority"`, `"assign"` to the union type. All existing handlers for `"resume"`, `"dismiss"`, `"view"`, `"approve"`, `"deny"` continue to work. Just add new entries to the handler map in `registerCallbackHandler`.

2. **callback_data 64-byte limit constrains design**: The story ID (e.g., `"49-1-portfolio-dashboard-page-structure"`) is 35+ chars. With JSON envelope `{"a":"assign","t":"..."}` that's ~50+ bytes — still under 64 for most IDs. BUT the priority and assign actions need extra data (which priority level? which agent?). Strategy:
   - **Block/unblock**: Simple — `encodeCallbackData("block", storyId)` — fits easily.
   - **Priority**: Two-step flow — first tap [Priority] shows a message with [High] [Normal] [Low] buttons using `encodeCallbackData("priority", storyId + ":high")`. Encode priority level in targetId using a separator (`:`).
   - **Assign**: Two-step flow — first tap [Assign] triggers a handler that lists available agents. Each agent button uses `encodeCallbackData("assign", storyId + ":" + agentId)`. Encode agent selection in targetId using separator.

3. **TargetId encoding convention**: For multi-parameter actions, use `storyId:param` format in targetId:
   - `encodeCallbackData("priority", "49-1-portfolio-dashboard:high")`
   - `encodeCallbackData("assign", "49-1-portfolio-dashboard:agent-claude-1")`
   - Parse with `targetId.split(":")` in handlers. Story ID is always first segment.
   - **MUST verify total callback_data stays under 64 bytes** — if storyId + agentId is too long, truncate or use a shorter alias.

4. **Use existing web API routes**: Story status changes go through `PATCH /api/sprint/{project}/story/{id]`. Priority changes go through `StateManager.update()`. Agent assignment uses the cross-project assignment flow. Do NOT reimplement these — call them from the handler factories.

5. **Project context for actions**: Story IDs include the epic number (e.g., `49-1-*` maps to project for epic 49). The project can be resolved from the existing `resolveProjectKey()` helper or from the event metadata.

6. **No changes to registerCallbackHandler() method body**: The callback handler infrastructure from Story 57.11 is complete. Just pass new action handlers in the map.

7. **No changes to existing command handlers**: Do NOT modify `registerStatusCommand`, `registerFleetCommand`, `registerSprintCommand`, `registerHealthCommand`, `registerConflictsCommand`, `registerSetProjectCommand`, or existing callback handlers.

### Existing Infrastructure (Already Built)

**StateManager in `@composio/ao-core`** (Story 46b):
```typescript
interface StateManager {
  get(storyId: string): Promise<StoryState | null>;
  set(storyId: string, state: StoryState): Promise<SetResult>;
  update(storyId: string, updates: Partial<StoryState>, expectedVersion?: string): Promise<SetResult>;
  // ...
}

interface StoryState {
  id: string;
  status: StoryStatus;        // "backlog" | "ready-for-dev" | "in-progress" | "review" | "done" | "blocked"
  title: string;
  assignedAgent?: string;      // Update for "assign to agent"
  urgency?: UrgencyLevel;      // "critical" | "high" | "normal" | "low" — Update for "priority"
  version: string;
  updatedAt: string;
}
```

**PATCH /api/sprint/{project}/story/{id]** (Story in Sprint API):
```typescript
// Request body: { status: string, force?: boolean }
// Returns: { storyId, status, changed, warnings, unblockedStories }
// Note: BMAD_COLUMNS = ["backlog", "ready-for-dev", "in-progress", "review", "done"]
// "blocked" is NOT in BMAD_COLUMNS — blocking needs StateManager directly
```

**GET /api/sprint/{project}/assignable-agents**:
```typescript
// Returns: { agents: Array<{ agentId, projectId, isPoolAgent, currentWorkload, capacityStatus }>, summary }
```

**CallbackAction and callback infrastructure** (Story 57.11):
```typescript
type CallbackAction = "resume" | "dismiss" | "view" | "approve" | "deny"; // EXTEND with new actions
function encodeCallbackData(action, targetId, eventId?): string; // Already generic
function decodeCallbackData(data): CallbackData | undefined;     // Already generic
```

**registerCallbackHandler() method** (Story 57.11):
Already handles idempotency (processedCallbacks Set capped at 1000), error recovery, answerCallbackQuery in finally block. New story action handlers just plug into this mechanism.

### callback_data Size Budget

| Action | targetId Pattern | Approximate Bytes |
|--------|-----------------|-------------------|
| block | `49-1-some-story` | `{"a":"block","t":"49-1-some-story"}` ≈ 38 |
| unblock | `49-1-some-story` | `{"a":"unblock","t":"49-1-some-story"}` ≈ 40 |
| priority | `49-1-some-story:high` | `{"a":"priority","t":"49-1-some-story:high"}` ≈ 47 |
| assign | `49-1-some-story:agent-1` | `{"a":"assign","t":"49-1-some-story:agent-1"}` ≈ 48 |

All well under 64 bytes. **But MUST validate at runtime** — if the combined storyId + param exceeds ~45 chars, the encode will throw. The handler should catch this and skip the button.

### Story Action Button Layout

For story notifications:
```
[Block] [Priority] [Assign]
```

After tapping [Priority]:
```
*Story Quick Action*
Story: 49\\-1\\-portfolio\\-dashboard
Select priority:

[High] [Normal] [Low]
```

After tapping [High]:
```
Priority set to high
Story: 49\\-1\\-portfolio\\-dashboard
```

### File Structure

```
packages/plugins/notifier-telegram/src/
├── telegram-bot.ts             # MODIFY: extend CallbackAction, add buildStoryActionButtons(), formatStoryActionMessage()
├── notification-plugin.ts      # MODIFY: add story action buttons to story event notifications
├── index.ts                    # MODIFY: add re-exports for new types/functions
├── markdown-escape.ts          # UNCHANGED
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add story action button and message tests
    ├── notification-plugin.test.ts # MODIFY: add test for story action buttons in notifications
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
├── route.ts                    # MODIFY: add createBlockHandler, createPriorityHandler, createAssignHandler, wire to registerCallbackHandler
└── route.test.ts               # MODIFY: add story action handler wiring tests
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-12. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes story IDs, agent names, priority levels, project names.

7. **grammY callback pattern**: Use `this.bot.callbackQuery(async (ctx) => { ... })` — already registered by `registerCallbackHandler()` from Story 57.11. Just add new action entries to the handler map.

8. **Type ordering**: Types come BEFORE the constants and functions that reference them.

9. **Provider backward compatibility**: All existing command registrations must continue to work unchanged.

10. **No changes to command handlers**: Do NOT modify `registerStatusCommand`, `registerFleetCommand`, `registerSprintCommand`, `registerHealthCommand`, `registerConflictsCommand`, `registerSetProjectCommand`, or existing callback handlers (resume, dismiss, approve, deny).

11. **No changes to `registerCallbackHandler()` method body**: The callback handler infrastructure from Story 57.11 is complete. Just pass new action handlers in the map.

12. **CallbackAction extension is additive**: Adding new actions to the union type does NOT break existing code.

13. **Use shared ApprovalService singleton pattern**: When importing services in route.ts, use shared singletons (like `approvalService` from `@/app/api/approvals/shared.js`) rather than creating new instances. For StateManager access, use `getServices()` to obtain the shared instance.

### Previous Story Learnings (57-12 Code Review)

The code review for Story 57-12 identified these critical patterns — the dev agent MUST avoid these mistakes:

1. **CRITICAL: Use shared service singletons, NOT new instances**: Story 57-12 initially created a separate `ApprovalService` instance via `createApprovalService()` instead of importing the shared singleton from `@/app/api/approvals/shared.js`. This meant Telegram approve/deny buttons queried an EMPTY store. ALWAYS import shared singletons.

2. **Pass CallbackUserInfo to action handlers**: The handler signature is `(targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string>`. Always extract `userInfo` from `ctx.callbackQuery.from` and pass it to handlers. Use it to identify who took the action.

3. **Guard empty/invalid IDs**: `buildApprovalButtons()` was missing a guard for empty `approvalId`. All button builders must guard their inputs and return `undefined` for invalid data.

4. **Catch encode errors for long IDs**: `encodeCallbackData()` throws when callback_data exceeds 64 bytes. Button builders MUST wrap in try/catch and return `undefined` on failure. Log a warning.

5. **Validate decoded actions**: `decodeCallbackData()` should reject unknown action strings. When adding new CallbackAction values, also add them to `VALID_CALLBACK_ACTIONS` set.

6. **No unsafe double-casts**: Never use `as unknown as T` — use proper type narrowing or extend the type.

7. **Wrap sends in try/catch**: `sendWithRetry()` can fail. Always wrap in try/catch with error logging.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `buildStoryActionButtons()` returns Block, Priority, Assign buttons
- `buildStoryActionButtons()` returns `undefined` for empty storyId
- `buildStoryActionButtons()` callback data decodes correctly
- `buildStoryActionButtons()` returns `undefined` when callback data exceeds 64 bytes
- `formatStoryActionMessage()` escapes dynamic content
- CallbackAction extended — encode/decode round-trip with "block", "unblock", "priority", "assign"
- Story action callback data stays under 64 bytes

**Unit tests (notification-plugin.test.ts — additions):**
- `send()` includes story action buttons for story-related event types
- `send()` includes existing buttons for non-story events

**Webhook route test additions:**
- Test `createBlockHandler` updates story status and returns success text
- Test `createPriorityHandler` updates urgency and returns confirmation
- Test `createAssignHandler` triggers assignment and returns confirmation
- Test error handling for each handler (API failure, story not found)
- Test `registerCallbackHandler` is called with all new handlers
- Test targetId parsing with colon separator (`storyId:param`)

### NFRs
- **NFR-I3-1:** Interactive action processed within 2 seconds (enforced via answerCallbackQuery in finally block — inherited from Story 57.11)
- **NFR-I3-2:** Callback queries are idempotent (Set-based tracking — inherited from Story 57.11)
- **NFR-P4:** Command responses return within 3 seconds (unchanged for commands)
- **NFR-S1:** Telegram bot authentication uses secure token validation (unchanged)

### References
- [Source: epics-cycle-10.md#Story 57.13] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I3-4] — "Users can perform quick story actions"
- [Source: prd-cycle-10.md#FR-I3-1] — "Notifications include interactive buttons"
- [Source: prd-cycle-10.md#NFR-I3-1] — "Interactive action processed within 2 seconds"
- [Source: prd-cycle-10.md#NFR-I3-2] — "Callback queries are idempotent"
- [Source: packages/core/src/types.ts#StoryState] — Story state with status, urgency, assignedAgent
- [Source: packages/core/src/types.ts#SessionManager] — spawn(), send() methods
- [Source: packages/core/src/types.ts#StateManager] — update() for status/urgency changes
- [Source: packages/core/src/types.ts#AgentRegistry] — Agent tracking and assignment
- [Source: packages/web/src/app/api/sprint/[project]/story/[id]/route.ts] — PATCH endpoint for story status
- [Source: packages/web/src/app/api/sprint/[project]/assignable-agents/route.ts] — GET endpoint for available agents
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#CallbackAction] — Current type
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#buildNotificationButtons] — Button builder pattern
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#buildApprovalButtons] — Button builder pattern (with guards)
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerCallbackHandler] — Callback handler infrastructure
- [Source: packages/web/src/app/api/telegram/webhook/route.ts#createApproveHandler] — Handler factory pattern
- [Source: packages/web/src/app/api/telegram/webhook/route.ts#createResumeHandler] — Handler factory pattern
- [Source: _bmad-output/implementation-artifacts/57-12-interactive-approval-flow.md] — Previous story with learnings

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
