# Story 57.12: Interactive Approval Flow

Status: ready-for-dev

## Story

As a **project manager**,
I want **to approve or deny requests via Telegram buttons**,
so that **I can handle approvals without opening the dashboard**.

## Acceptance Criteria

1. **Given** a request requires my approval (story reassignment, conflict resolution)
   **When** I receive the approval request via Telegram
   **Then** I see [Approve] and [Deny] buttons
   **And** the message includes the action type, target, and requester

2. **Given** I tap [Approve] on an approval request
   **When** the button callback is processed
   **Then** the message updates to show "Approved by <user>" (no new message)
   **And** `ApprovalService.approve()` is called with the approval ID and user identity
   **And** the approval result is reflected in the system

3. **Given** I tap [Deny] on an approval request
   **When** the button callback is processed
   **Then** the message updates to show "Denied by <user>"
   **And** `ApprovalService.reject()` is called with the approval ID and user identity

4. **Given** I tap a button on an already-resolved approval
   **When** the callback fires
   **Then** the bot answers with "Already resolved" (no error, no duplicate action)
   **And** idempotency is preserved per NFR-I3-2

5. **Given** an approval request expires (timeout exceeded)
   **When** I tap a button on the expired notification
   **Then** the message updates to show "Approval expired"

6. **Given** a callback query arrives for an approval action
   **When** the bot processes it
   **Then** `answerCallbackQuery` is called within 2 seconds (NFR-I3-1)
   **And** the message is edited via `editMessageText` to reflect the result

7. **Given** the approval handler encounters an error
   **When** executing the action (e.g., approval not found)
   **Then** the message updates to show the error
   **And** `answerCallbackQuery` is still called (prevents Telegram "clock" icon)

## Tasks / Subtasks

- [ ] Task 1: Extend CallbackAction type for approval actions (AC: #2, #3)
  - [ ] 1.1: Update `CallbackAction` type in `telegram-bot.ts` to `"resume" | "dismiss" | "view" | "approve" | "deny"`
  - [ ] 1.2: Update `encodeCallbackData()` / `decodeCallbackData()` — no code changes needed (already generic), just verify they work with new action strings
  - [ ] 1.3: Verify existing tests still pass with the extended type

- [ ] Task 2: Create `buildApprovalButtons()` helper (AC: #1)
  - [ ] 2.1: Create `buildApprovalButtons(approvalId: string, action: string, target: string): InlineKeyboard` function in `telegram-bot.ts`
  - [ ] 2.2: Return `[[{text: "Approve", callback_data: encode("approve", approvalId)}, {text: "Deny", callback_data: encode("deny", approvalId)}]]`
  - [ ] 2.3: Keep button text under 20 chars for mobile readability
  - [ ] 2.4: Export from `telegram-bot.ts` and `index.ts`

- [ ] Task 3: Create `formatApprovalMessage()` helper (AC: #1)
  - [ ] 3.1: Create `formatApprovalMessage(request: { action: string; target: string; requestedBy: string; requestedAt: string }): string` in `telegram-bot.ts`
  - [ ] 3.2: Format: `*Approval Request*\nAction: <action>\nTarget: <target>\nRequested by: <requestedBy>\nTime: <requestedAt>`
  - [ ] 3.3: Escape all dynamic content with `escapeMarkdownV2()`
  - [ ] 3.4: Export from `telegram-bot.ts` and `index.ts`

- [ ] Task 4: Create `sendApprovalRequest()` method on TelegramBot (AC: #1)
  - [ ] 4.1: Add `sendApprovalMessage(chatId: string | number, request: ApprovalRequest): Promise<void>` method to TelegramBot
  - [ ] 4.2: Build message text via `formatApprovalMessage(request)`
  - [ ] 4.3: Build buttons via `buildApprovalButtons(request.id, request.action, request.target)`
  - [ ] 4.4: Send via `sendWithRetry()` with `reply_markup: { inline_keyboard: buttons }`
  - [ ] 4.5: Handle case where `request.status !== "pending"` — skip sending (log warning)

- [ ] Task 5: Wire approval/deny handlers in webhook route (AC: #2, #3, #5)
  - [ ] 5.1: Create `createApproveHandler(approvalService, userIdResolver)` that calls `approvalService.approve(id, userId)` and returns result text
  - [ ] 5.2: Create `createDenyHandler(approvalService, userIdResolver)` that calls `approvalService.reject(id, userId)` and returns result text
  - [ ] 5.3: Handle "not found" and "already resolved" errors with user-friendly messages
  - [ ] 5.4: Handle "expired" status — detect from `ApprovalResult.error` or check status
  - [ ] 5.5: In `getBot()`: add `approve` and `deny` to the `registerCallbackHandler` map
  - [ ] 5.6: `userIdResolver` maps Telegram chat ID to user identity (from chat context or config)

- [ ] Task 6: Integrate with notification-plugin for approval events (AC: #1)
  - [ ] 6.1: In `notification-plugin.ts`: detect `approval.requested` event type
  - [ ] 6.2: For approval events: call `formatApprovalMessage()` + `buildApprovalButtons()` instead of generic notification
  - [ ] 6.3: Ensure approval notifications always use inline keyboard (no plain text fallback for approvals)

- [ ] Task 7: Add tests (AC: all)
  - [ ] 7.1: Test `buildApprovalButtons()` returns Approve and Deny buttons with valid callback data
  - [ ] 7.2: Test `formatApprovalMessage()` escapes dynamic content
  - [ ] 7.3: Test `sendApprovalMessage()` sends message with inline keyboard
  - [ ] 7.4: Test `sendApprovalMessage()` skips non-pending requests
  - [ ] 7.5: Test approve handler calls `approvalService.approve()` and returns success text
  - [ ] 7.6: Test deny handler calls `approvalService.reject()` and returns success text
  - [ ] 7.7: Test approve handler returns "Already resolved" for non-pending approval
  - [ ] 7.8: Test approve handler returns "Approval expired" for expired request
  - [ ] 7.9: Test approve handler returns error for unknown approval ID
  - [ ] 7.10: Test idempotency: second tap returns "Already processed" (existing mechanism)
  - [ ] 7.11: Test notification-plugin sends approval buttons for `approval.requested` event
  - [ ] 7.12: Test `CallbackAction` type extended with "approve" and "deny" (existing encode/decode round-trip)
  - [ ] 7.13: Run full test suite — 0 regressions

- [ ] Task 8: Update sprint-status.yaml

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
- `ApprovalService.approve(id, approvedBy)` — EXISTING: from `@composio/ao-core` (Story 46b.2)
- `ApprovalService.reject(id, rejectedBy)` — EXISTING: from `@composio/ao-core` (Story 46b.2)
- `ApprovalService.getPending()` — EXISTING: from `@composio/ao-core`
- `ApprovalRequest` type — EXISTING: from `@composio/ao-core` (id, action, target, requestedBy, requestedAt, status, resolvedBy, resolvedAt, timeoutMs)
- `ApprovalResult` type — EXISTING: from `@composio/ao-core` (success, approval, error?)
- `CallbackAction` type — EXTENDING: add "approve" | "deny" (currently "resume" | "dismiss" | "view")
- `encodeCallbackData()` / `decodeCallbackData()` — EXISTING: from Story 57.11, already generic
- `registerCallbackHandler()` — EXISTING: from Story 57.11, accepts Partial<Record<CallbackAction, Handler>>
- `sendWithRetry()` — EXISTING: from `./send-helpers.js`
- `escapeMarkdownV2()` — EXISTING: from `./markdown-escape.js`
- `TelegramBot.sendApprovalMessage()` — NEW: created in this story

**Feature Flags:**
- `APPROVAL_SERVICE_WIRED` — Verify ApprovalService is accessible via `getServices()`. If not, it may need to be added to the services container.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — ApprovalService, ApprovalRequest, ApprovalResult)
- `grammy` (already reviewed in Story 57-1, approved: MIT)

## Dev Notes

### Architecture Context

This is **Story 12 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1 through 57-11** (all done).

**Dependency chain:** Stories 57-1 through 57-11 (done) → **Story 57-12 (this story)** → Story 57-13 (story quick actions) → Stories 57-14+

### What This Story Actually Does

**The problem:** Some orchestrator actions require human approval before proceeding (e.g., spawning agents in supervised mode, killing sessions, autopilot advances). Currently, approvals must be handled through the dashboard. This is a bottleneck when the PM is away from their desk.

**The solution:** When an action requires approval, send a Telegram message with [Approve] and [Deny] buttons. The PM can resolve approvals from their phone with a single tap. The message updates in-place to show the result.

**What this does NOT do:**
- Story quick actions like assign/priority change (Story 57-13)
- Multi-step conversations (Story 57-14)
- Notification deduplication (Story 57-15)
- Creating new approval types — this uses the existing ApprovalService from Story 46b.2

### Key Design Decisions

1. **Extend existing CallbackAction type**: Add "approve" and "deny" to the existing union type. The `encodeCallbackData()` / `decodeCallbackData()` helpers are already generic and work with any action string. The `registerCallbackHandler()` method already accepts `Partial<Record<CallbackAction, Handler>>`, so new actions are wired by adding entries to the handler map.

2. **Reuse ApprovalService**: The core `ApprovalService` (Story 46b.2) already handles the approval lifecycle (request, approve, reject, expire, getPending). This story wires it to Telegram — we do NOT reimplement approval logic.

3. **Approval ID as targetId**: The `encodeCallbackData()` format uses `targetId` for the primary identifier. For approval callbacks, `targetId` = the `ApprovalRequest.id` (UUID). This is ~36 chars + JSON overhead = well under 64 bytes.

4. **User identity resolution**: `ApprovalService.approve(id, approvedBy)` requires a user identity string. We resolve this from the Telegram chat context — either from the configured `allowedChatIds` mapping or from `ctx.callbackQuery.from.username` / `.id`. This maps Telegram user to orchestrator user identity.

5. **Separate `buildApprovalButtons()` from `buildNotificationButtons()`**: Approval buttons have a different layout ([Approve] [Deny]) than notification buttons ([Resume] [View] [Dismiss]). A dedicated builder keeps the approval flow clean and testable.

6. **`sendApprovalMessage()` on TelegramBot**: Unlike notification buttons (built in `notification-plugin.ts`), approval messages need a dedicated send method because they include structured metadata (action type, target, requester) in a specific format.

7. **Expire handling**: When the user taps a button on an expired approval, `ApprovalService.approve()` returns `{ success: false, error: "Cannot approve: status is expired" }`. The handler detects this and shows "Approval expired" in the edited message.

### Existing Infrastructure (Already Built)

**`ApprovalService` in `@composio/ao-core`** (Story 46b.2):
```typescript
interface ApprovalService {
  requestApproval(action, target, requestedBy, timeoutMs?): ApprovalRequest;
  approve(id, approvedBy): ApprovalResult;
  reject(id, rejectedBy): ApprovalResult;
  getPending(): ApprovalRequest[];
  getAll(): ApprovalRequest[];
  isApprovalRequired(action, requiredActions): boolean;
}

interface ApprovalRequest {
  id: string;           // UUID
  action: string;       // "spawn", "kill", "autopilot-advance"
  target: string;       // agent ID or resource
  requestedBy: string;  // user/system identity
  requestedAt: string;  // ISO timestamp
  status: "pending" | "approved" | "rejected" | "expired";
  resolvedBy?: string;
  resolvedAt?: string;
  timeoutMs?: number;
}

interface ApprovalResult {
  success: boolean;
  approval: ApprovalRequest;
  error?: string;
}
```

**`CallbackAction` and callback infrastructure** (Story 57.11):
```typescript
type CallbackAction = "resume" | "dismiss" | "view";  // EXTEND to add "approve" | "deny"

function encodeCallbackData(action, targetId, eventId?): string;  // Already generic
function decodeCallbackData(data): CallbackData | undefined;       // Already generic

// registerCallbackHandler accepts Partial<Record<CallbackAction, Handler>>
// Just add "approve" and "deny" entries to the handler map
```

**`registerCallbackHandler()` method** (Story 57.11):
Already handles idempotency, error recovery, answerCallbackQuery in finally block. New approval/deny handlers just plug into this existing mechanism.

**Autopilot supervised mode** (`packages/core/src/autopilot.ts`):
Already uses `ApprovalService` for supervised mode — sends notification, awaits approval. This story adds the Telegram button interface for resolving those approvals.

### Approval Message Format

```
*Approval Request*
Action: spawn
Target: agent\\-1
Requested by: autopilot
Time: 2026\\-04\\-10T12:00:00\\.000Z

[Approve] [Deny]
```

After tapping [Approve]:
```
Approved by bob
Action: spawn — agent\\-1
```

### Callback Data Format for Approvals

```typescript
encodeCallbackData("approve", "uuid-of-approval-request")
// → '{"a":"approve","t":"550e8400-e29b-41d4-a716-446655440000"}'  (67 bytes — within 64 byte limit?)

// Wait — UUID is 36 chars. Let's check:
// {"a":"approve","t":"550e8400-e29b-41d4-a716-446655440000"} = 60 chars
// UTF-8 byte count = 60 (all ASCII). Under 64. OK.

encodeCallbackData("deny", "550e8400-e29b-41d4-a716-446655440000")
// → '{"a":"deny","t":"550e8400-e29b-41d4-a716-446655440000"}'  (58 bytes)
```

### User Identity Resolution

The `ApprovalService.approve(id, approvedBy)` needs a string identifying the approver. Options:

1. **Telegram username**: `ctx.callbackQuery.from.username` — may not exist for all users
2. **Telegram user ID**: `ctx.callbackQuery.from.id.toString()` — always available
3. **Config mapping**: Map `allowedChatIds` to user names

**Recommended**: Use Telegram username if available, fallback to user ID string prefixed with `tg:`. Example: `"bob"` or `"tg:123456789"`.

### File Structure

```
packages/plugins/notifier-telegram/src/
├── telegram-bot.ts             # MODIFY: extend CallbackAction, add buildApprovalButtons(), formatApprovalMessage(), sendApprovalMessage()
├── notification-plugin.ts      # MODIFY: handle approval.requested event type
├── index.ts                    # MODIFY: add re-exports for new types/functions
├── markdown-escape.ts          # UNCHANGED
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add approval button, message, and send tests
    ├── notification-plugin.test.ts # MODIFY: add test for approval event handling
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
├── route.ts                    # MODIFY: add createApproveHandler, createDenyHandler, wire to registerCallbackHandler
└── route.test.ts               # MODIFY: add approval handler wiring tests
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-11. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes approval action types, target IDs, requester names, timestamps.

7. **grammY callback pattern**: Use `this.bot.callbackQuery(async (ctx) => { ... })` — already registered by `registerCallbackHandler()` from Story 57.11. Just add new action entries to the handler map.

8. **Type ordering**: Types come BEFORE the constants and functions that reference them.

9. **Provider backward compatibility**: All existing command registrations must continue to work unchanged.

10. **No changes to command handlers**: Do NOT modify `registerStatusCommand`, `registerFleetCommand`, `registerSprintCommand`, `registerHealthCommand`, `registerConflictsCommand`, `registerSetProjectCommand`, or existing callback handlers.

11. **No changes to `registerCallbackHandler()` method body**: The callback handler infrastructure from Story 57.11 is complete. Just pass new action handlers in the map.

12. **CallbackAction extension is additive**: Adding "approve" and "deny" to the union type does NOT break existing code. All existing handlers for "resume", "dismiss", "view" continue to work.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `buildApprovalButtons()` returns Approve and Deny buttons
- `buildApprovalButtons()` callback data decodes correctly
- `formatApprovalMessage()` escapes dynamic content
- `sendApprovalMessage()` sends with inline keyboard
- `sendApprovalMessage()` skips non-pending requests
- `CallbackAction` extended — encode/decode round-trip with "approve" and "deny"
- Approval callback data stays under 64 bytes for UUID targetId

**Unit tests (notification-plugin.test.ts — additions):**
- `send()` includes approval buttons for `approval.requested` event
- `send()` sends plain message for non-approval events

**Webhook route test additions:**
- Test `createApproveHandler` calls `approvalService.approve()` and returns success text
- Test `createDenyHandler` calls `approvalService.reject()` and returns success text
- Test approve handler returns error for unknown approval ID
- Test approve handler returns "already resolved" for non-pending approval
- Test `registerCallbackHandler` is called with approve and deny handlers

### NFRs
- **NFR-I3-1:** Interactive action processed within 2 seconds (enforced via answerCallbackQuery in finally block — inherited from Story 57.11)
- **NFR-I3-2:** Callback queries are idempotent (Set-based tracking — inherited from Story 57.11)
- **NFR-P4:** Command responses return within 3 seconds (unchanged for commands)
- **NFR-S1:** Telegram bot authentication uses secure token validation (unchanged)

### References
- [Source: epics-cycle-10.md#Story 57.12] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I3-2] — "Users can approve/deny actions from Telegram"
- [Source: prd-cycle-10.md#FR-I3-3] — "Interactive elements update in-place after action"
- [Source: prd-cycle-10.md#NFR-I3-1] — "Interactive action processed within 2 seconds"
- [Source: prd-cycle-10.md#NFR-I3-2] — "Callback queries are idempotent (safe to retry)"
- [Source: packages/core/src/approval-service.ts] — ApprovalService with requestApproval, approve, reject, getPending
- [Source: packages/core/src/__tests__/approval-service.test.ts] — Approval service test patterns
- [Source: packages/core/src/autopilot.ts] — Supervised mode approval flow (pendingApprovals map)
- [Source: packages/core/src/config.ts#L206] — approvalRequired Zod schema
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#CallbackAction] — Current type: "resume" | "dismiss" | "view"
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerCallbackHandler] — Existing callback handler infrastructure
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#encodeCallbackData] — Generic encoder (works with any action string)
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#buildNotificationButtons] — Pattern for button builders
- [Source: packages/web/src/app/api/telegram/webhook/route.ts#createResumeHandler] — Pattern for action handler factories
- [Source: _bmad-output/implementation-artifacts/57-11-inline-action-buttons.md] — Previous story with learnings

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
