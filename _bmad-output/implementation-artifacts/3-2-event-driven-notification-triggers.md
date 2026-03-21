# Story 3.2: Event-Driven Notification Triggers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to receive push notifications when agents get blocked, conflicts are detected, or the event bus backlog grows,
so that I'm alerted when my judgment is needed without constantly monitoring.

## Acceptance Criteria

1. **AC1 — Event-to-notification trigger rules:** The NotificationService classifies events using a configurable trigger map instead of the current hardcoded `includes()` pattern. Trigger rules map specific event types to notification priorities:
   - `agent.blocked` → critical push (immediate)
   - `conflict.detected` → critical push (immediate)
   - `story.blocked` → critical push (immediate)
   - `agent.offline` → warning push (immediate) — NEW event type, publish from blocked-agent-detector when agent inactive beyond a higher threshold
   - `eventbus.backlog` → critical push (immediate) — already published by NotificationService when queue exceeds threshold
   - `notification.backlog` → critical push (already exists)
   - `story.completed` → info, log only (no push notification)
   - `story.started` → info, log only
   - `story.assigned` → info, log only
   - `agent.resumed` → info, log only
   - Events not in the trigger map → ignored (no notification)

2. **AC2 — Actionable notification context:** Each notification includes contextual information that helps the developer act immediately:
   - **Agent ID** extracted from `event.metadata.agentId` (or "system" fallback)
   - **Story ID** extracted from `event.metadata.storyId` (or empty)
   - **Reason** extracted from `event.metadata.reason` (if present)
   - **Suggested CLI commands** appended to the notification message:
     - `agent.blocked` → `Run: ao status <agentId>` / `ao resume <storyId>`
     - `conflict.detected` → `Run: ao resolve-conflicts`
     - `agent.offline` → `Run: ao fleet` / `ao status <agentId>`
     - `eventbus.backlog` → `Run: ao events --tail`
   - Title and message must be human-readable, not raw event type strings

3. **AC3 — Info events log-only:** Events classified as `info` priority are logged to console (via `console.log`) but NOT dispatched to notification plugins. This prevents low-priority events (story.completed, story.started) from spamming notification channels. Only `critical` and `warning` events are sent through the plugin delivery pipeline.

4. **AC4 — Delivery latency under 1 second:** The time from event bus publish to notification plugin `send()` call is under 1 second. This is measured by comparing `event.timestamp` to `Date.now()` at send time. If latency exceeds 1s, a warning is logged (non-fatal). No Redis or external queuing needed — the in-memory path is inherently fast.

5. **AC5 — Comprehensive test coverage:** Tests verify:
   - Each event type maps to the correct priority
   - Actionable context is included in notification messages
   - Info-priority events are logged but not sent to plugins
   - Unknown event types produce no notification
   - Latency measurement works correctly
   - Metadata extraction handles missing fields gracefully

## Tasks / Subtasks

- [x] Task 1: Refactor `getPriorityFromEventType()` into configurable trigger map (AC: #1)
  - [x] 1.1 Create `NotificationTrigger` type in types.ts: `{ priority: NotificationPriority; title: string }`
  - [x] 1.2 Define `DEFAULT_TRIGGER_MAP` constant with all 10 event-type-to-priority mappings from AC1
  - [x] 1.3 Add optional `triggerMap` field to `NotificationServiceConfig` interface in types.ts
  - [x] 1.4 Replace `getPriorityFromEventType()` with `getTrigger()` — exact match lookup in trigger map
  - [x] 1.5 Replace `getTitleFromEventType()` — title now comes from trigger map entry
  - [x] 1.6 Unknown event types return null from `getTrigger()` — no notification generated

- [x] Task 2: Enhance notification context with actionable information (AC: #2)
  - [x] 2.1 Created `getActionableContext()` private method with CLI suggestions per event type
  - [x] 2.2 Created `buildMessage()` that combines base message + reason + CLI suggestion
  - [x] 2.3 Metadata extraction handles missing `agentId`, `storyId`, `reason` gracefully with defaults
  - [x] 2.4 Format includes reason and CLI suggestion in notification message

- [x] Task 3: Implement info-priority log-only filtering (AC: #3)
  - [x] 3.1 In `subscribeToEvents()` callback, check trigger priority before building notification
  - [x] 3.2 If priority === "info": `console.log("[notification] {title}: {message}")` and return
  - [x] 3.3 If priority === "critical" or "warning": build full Notification and call `this.send()`
  - [x] 3.4 Info events are deduped (prevents log spam) then logged via console.log only

- [x] Task 4: Add delivery latency measurement (AC: #4)
  - [x] 4.1 Record `Date.now()` at start of subscribeToEvents callback
  - [x] 4.2 After `this.send()` completes, compute `latencyMs = Date.now() - startTime`
  - [x] 4.3 If latencyMs > 1000ms, `console.warn` with threshold exceeded message
  - [x] 4.4 Added `lastLatencyMs` to `NotificationStatus` in types.ts for observability

- [-] Task 5: Publish `agent.offline` event from BlockedAgentDetector (AC: #1)
  - [x] 5.1 Verified BlockedAgentDetector publishes `agent.blocked` and `agent.resumed` only
  - [-] 5.2 BlockedAgentDetector uses a single inactivity threshold — no distinction between "blocked" and "offline"
  - [x] 5.3 Documented as deferred: `agent.offline` trigger is in DEFAULT_TRIGGER_MAP but no publisher exists yet. Deferred to Epic 4 (Self-Healing Operations) where health monitoring will add offline detection with configurable thresholds.

- [x] Task 6: Write comprehensive tests (AC: #5)
  - [x] 6.1 Unit tests for trigger map: 7 tests covering each event type → correct priority, custom map, merge with defaults
  - [x] 6.2 Unit tests for actionable context: 5 tests for CLI suggestions in agent.blocked, conflict.detected, agent.offline, story.blocked, notification.backlog
  - [x] 6.3 Unit tests for info log-only: 4 tests — story.completed, story.started, agent.resumed log only; critical events still sent to plugins
  - [x] 6.4 Unit tests for unknown events: covered in AC1 tests — unknown events ignored
  - [x] 6.5 Unit tests for latency measurement: 3 tests — lastLatencyMs tracked, warn on >1s, no warn under threshold
  - [x] 6.6 Unit tests for metadata extraction: covered in AC2 tests — missing metadata handling
  - [x] 6.7 Integration test: covered via mock EventBus subscribe → callback invocation → plugin.send verification

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

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

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
- [x] `NotificationService.send(notification)` — sends to plugins (already exists)
- [x] `NotificationServiceConfig.eventBus` — EventBus reference (already exists)
- [x] `EventBus.subscribe(callback)` — event subscription (already used in subscribeToEvents)
- [x] `EventBus.publish(event)` — event publishing (already used for backlog)
- [x] `NotificationPlugin.send(notification)` — per-plugin delivery (already exists)
- [x] `NotificationPlugin.isAvailable()` — plugin check (already exists)
- [x] `Notification` interface — eventId, eventType, priority, title, message, metadata, timestamp
- [x] `EventBusEvent` interface — eventId, eventType, timestamp, metadata
- [x] `NotificationStatus` — queueDepth, dedupCount, dlqSize, lastProcessedTime, lastLatencyMs (NEW)
- [x] Verify each method exists in `packages/core/src/types.ts`

**Feature Flags:**
- [x] No new feature flags needed — all interfaces exist. `agent.offline` publisher deferred (see Limitations below)
- [x] Use pattern from packages/core/INTERFACE_VALIDATION_CHECKLIST.md

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## CLI Integration Testing (if applicable)

Not applicable — this story modifies core notification-service internals. No new CLI commands added.

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story enhances the **existing** `NotificationService.subscribeToEvents()` method in `core/src/notification-service.ts` to use a configurable trigger map instead of hardcoded `includes()` pattern matching. It also adds actionable context (CLI suggestions) to notification messages, filters info-priority events to log-only, and adds delivery latency measurement.

```
EventBus ──subscribe──► NotificationService.subscribeToEvents()
                              │
                        ┌─────▼──────────┐
                        │  Trigger Map    │  (event type → priority + title)
                        │  Lookup         │
                        └─────┬──────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              priority=info        priority=critical|warning
                    │                   │
              console.log()        Build Notification
              (log only)           + actionable context
                                        │
                                   this.send()
                                   (dedup → route → deliver)
                                        │
                                   Latency check
                                   (warn if >1s)
```

### What Already Exists (DO NOT REINVENT)

| Module | File | Key Methods | Status |
|--------|------|-------------|--------|
| NotificationService | `core/src/notification-service.ts` | subscribeToEvents(), getPriorityFromEventType(), getTitleFromEventType(), getMessageFromEventType() | MODIFY — replace hardcoded logic with trigger map |
| NotificationServiceConfig | `core/src/types.ts:1681-1694` | eventBus, plugins, dlqPath?, preferences? | EXTEND — add optional `triggerMap` field |
| NotificationStatus | `core/src/types.ts:1625-1634` | queueDepth, dedupCount, dlqSize | EXTEND — add optional `lastLatencyMs` |
| EventBusEvent | `core/src/types.ts:1460-1469` | eventId, eventType, timestamp, metadata | READ ONLY |
| Notification | `core/src/types.ts:1593-1610` | eventId, eventType, priority, title, message, metadata, timestamp | READ ONLY |
| BlockedAgentDetector | `core/src/blocked-agent-detector.ts` | publishes `agent.blocked`, `agent.resumed` | CHECK — may need `agent.offline` |
| EventPublisher | `core/src/event-publisher.ts` | publishStoryEvent(), publishAgentEvent() | READ ONLY — understand existing event types |
| Story 3-1 wiring | `cli/src/lib/wire-detection.ts:194-218` | createNotificationService() call | READ ONLY — already wired |
| Existing tests | `core/__tests__/notification-service.test.ts` | 1176 tests passing | EXTEND — add trigger map tests |

### What's MISSING (This Story Fills)

| Gap | Description |
|-----|-------------|
| Hardcoded event classification | `getPriorityFromEventType()` uses `includes("blocked")` — matches too broadly, no way to add new event types without code changes |
| No actionable context in notifications | Messages say "Story X agent is blocked" but don't tell developer what to do next |
| Info events sent to plugins | `story.completed` triggers plugin delivery — should be log-only |
| No latency tracking | No way to know if notifications are delivered within SLA |
| No `agent.offline` event | BlockedAgentDetector only publishes `agent.blocked` — no distinction for prolonged offline |

### Current `getPriorityFromEventType()` — Lines 278-293

```typescript
// CURRENT — REPLACE THIS:
private getPriorityFromEventType(eventType: string): "critical" | "warning" | "info" | null {
  if (eventType.includes("blocked") || eventType.includes("conflict")) {
    return "critical";
  }
  if (eventType.includes("failed") || eventType.includes("error")) {
    return "warning";
  }
  if (eventType.includes("completed") || eventType.includes("started") || eventType.includes("assigned")) {
    return "info";
  }
  return null;
}
```

**Problems with current approach:**
1. `includes("blocked")` matches ANY event with "blocked" in the name — too broad
2. No way to configure from outside the class
3. `agent.offline`, `eventbus.backlog` not handled
4. All events including info go through full plugin pipeline

### Target Implementation Pattern

```typescript
// NEW trigger map type
interface NotificationTrigger {
  priority: NotificationPriority;
  title: string;
}

// DEFAULT_TRIGGER_MAP — hardcoded defaults, overridable via config
const DEFAULT_TRIGGER_MAP: Record<string, NotificationTrigger> = {
  "agent.blocked":       { priority: "critical", title: "Agent Blocked" },
  "story.blocked":       { priority: "critical", title: "Story Blocked" },
  "conflict.detected":   { priority: "critical", title: "Conflict Detected" },
  "notification.backlog":{ priority: "critical", title: "Notification Backlog" },
  "eventbus.backlog":    { priority: "critical", title: "Event Bus Backlog" },
  "agent.offline":       { priority: "warning",  title: "Agent Offline" },
  "story.completed":     { priority: "info",     title: "Story Completed" },
  "story.started":       { priority: "info",     title: "Story Started" },
  "story.assigned":      { priority: "info",     title: "Story Assigned" },
  "agent.resumed":       { priority: "info",     title: "Agent Resumed" },
};

// REPLACE getPriorityFromEventType with trigger map lookup:
private getTrigger(eventType: string): NotificationTrigger | null {
  // Exact match first
  if (this.triggerMap[eventType]) {
    return this.triggerMap[eventType];
  }
  // No prefix/wildcard matching — explicit event types only
  return null;
}
```

### Actionable Context Pattern

```typescript
private getActionableContext(eventType: string, metadata: Record<string, unknown>): string {
  const agentId = String(metadata.agentId ?? "");
  const storyId = String(metadata.storyId ?? "");

  switch (eventType) {
    case "agent.blocked":
      return agentId ? `Run: ao status ${agentId}` : "Run: ao fleet";
    case "story.blocked":
      return storyId ? `Run: ao resume ${storyId}` : "Run: ao fleet";
    case "conflict.detected":
      return "Run: ao resolve-conflicts";
    case "agent.offline":
      return agentId ? `Run: ao fleet; ao status ${agentId}` : "Run: ao fleet";
    case "eventbus.backlog":
    case "notification.backlog":
      return "Run: ao events --tail";
    default:
      return "";
  }
}
```

### Info Log-Only Pattern

```typescript
// In subscribeToEvents() callback:
const trigger = this.getTrigger(event.eventType);
if (!trigger) return; // Unknown event — ignore

if (trigger.priority === "info") {
  // Log only, do not send to plugins
  console.log(`[notification] ${trigger.title}: ${this.getMessageFromEventType(event.eventType, event.metadata)}`);
  return;
}

// critical/warning — full plugin delivery pipeline
const notification: Notification = { ... };
await this.send(notification);
```

### Priority Mapping (Unchanged from Story 3-1)

| Epic Priority | Config Key | NotificationPriority | Behavior |
|--------------|------------|---------------------|----------|
| critical | urgent | critical | All channels (immediate) |
| high | action | warning | Primary channel (immediate) |
| medium | warning | — | Digest (Story 3-3, not this story) |
| low | info | info | Log only (this story) |

### Anti-Patterns to Avoid

- **Do NOT create a new service** — modify the existing `NotificationServiceImpl` class methods
- **Do NOT add a new EventBus subscription** — enhance the existing `subscribeToEvents()` callback
- **Do NOT use `includes()` for event matching** — use exact match lookup in trigger map
- **Do NOT make notification delivery fatal** — all try/catch patterns from Story 3-1 remain
- **Do NOT add Redis** — in-memory only for this story
- **Do NOT use `exec()` for shell commands** — always `execFile()` with timeouts
- **Do NOT use `Promise.all()` for independent items** — use `Promise.allSettled()`
- **Do NOT modify wire-detection.ts** — Story 3-1 already wired everything. Only modify core notification-service.ts
- **Do NOT break backward compatibility** — triggerMap is optional with sensible defaults
- **Do NOT filter info events from dedup** — dedup prevents log spam too
- **Do NOT add `eventbus.backlog` publishing** — it doesn't exist yet as an external event. The `notification.backlog` event IS already published internally by NotificationService (line 404). For `eventbus.backlog`, check if EventBus itself publishes this — if not, skip it and document as deferred

### Key Implementation Constraints

- **Modify, don't replace**: Refactor existing methods in `NotificationServiceImpl`. Keep the class structure.
- **Backward compatible**: `triggerMap` config field is optional. If not provided, use `DEFAULT_TRIGGER_MAP`.
- **Minimal types.ts changes**: Only add `triggerMap?: Record<string, { priority: NotificationPriority; title: string }>` to `NotificationServiceConfig` and optionally `lastLatencyMs?: number` to `NotificationStatus`.
- **Test existing tests still pass**: The 1176 existing core tests must continue passing. The refactored methods should produce the same outputs for the same inputs.
- **ESLint compliance**: Use `// eslint-disable-next-line no-console` for intentional console.log/warn calls in notification-service.ts.

### Cross-Story Dependencies

- **Story 3-1 (done)**: Wired NotificationService into CLI, created plugin adapters, routing preferences. This story builds on that foundation.
- **Story 3-3 (backlog)**: Will add configurable dedup windows and digest batching. This story's info log-only filtering is complementary (not overlapping).
- **Epic 4 (backlog)**: Self-healing operations will add circuit breaker, error classification. `agent.offline` may be refined there.

### Previous Story Intelligence (from Story 3-1)

**Learnings to apply:**
1. **ESLint hook blocks split edits** — combine import additions with usage in a single Edit operation
2. **Rebuild packages after modifying types.ts** — run `pnpm build` before `pnpm typecheck` when adding new fields to interfaces
3. **Non-fatal wiring pattern** — all event-driven services wrapped in try/catch. Apply same pattern to info logging
4. **Priority-based routing fallback** — `filterPluginsByPreference` now supports both event type pattern and priority fallback (code review fix from 3-1). The trigger map approach here is complementary — it determines WHETHER to notify, while preferences determine WHERE to notify.
5. **`validatePreferences` warns, doesn't throw** — same principle applies: bad trigger config should warn, not crash
6. **Test pattern**: Use `vi.fn()` for mock plugins, verify `.send()` called/not-called with expected args. Mock `console.log` and `console.warn` with `vi.spyOn().mockImplementation(() => {})`.

**Files touched in 3-1 (don't re-modify unless needed):**
- `cli/src/lib/wire-detection.ts` — already wired, no changes needed
- `cli/src/lib/plugins.ts` — plugin factories, no changes needed
- `plugins/notifier-{slack,webhook,composio}/src/notification-plugin.ts` — adapters, no changes needed

### Event Types Published in Codebase

| Event Type | Published By | Metadata Keys |
|-----------|-------------|---------------|
| `story.started` | EventPublisher | storyId, agentId |
| `story.completed` | EventPublisher | storyId, agentId |
| `story.blocked` | EventPublisher, StateConflictReconciler | storyId, reason |
| `story.unblocked` | DependencyResolver | storyId |
| `story.assigned` | EventPublisher | storyId, agentId |
| `agent.blocked` | BlockedAgentDetector | agentId, sessionId, storyId |
| `agent.resumed` | BlockedAgentDetector | agentId, sessionId |
| `conflict.detected` | ConflictNotification, StateConflictReconciler | storyId, conflictType |
| `conflict.resolved` | ConflictResolution, StateConflictReconciler | storyId, resolution |
| `notification.backlog` | NotificationService (line 405) | queueDepth |
| `sync.completed` | SyncService | — |
| `state.conflict_unresolved` | StateConflictReconciler | storyId, reason |

**Not yet published (planned):**
- `agent.offline` — needs BlockedAgentDetector enhancement or new detection
- `eventbus.backlog` — needs EventBus health monitoring (Epic 4)
- `queue.depth.exceeded` — needs queue monitoring (Epic 4)

### Testing Strategy

- **Unit tests for trigger map**: Verify exact match lookup, null for unknown events, DEFAULT_TRIGGER_MAP coverage
- **Unit tests for actionable context**: Each event type → correct CLI suggestion, missing metadata handling
- **Unit tests for info log-only**: Mock console.log, call subscribeToEvents callback with info event, verify `send()` NOT called
- **Unit tests for critical/warning delivery**: Call callback with blocked event, verify `send()` IS called with correct Notification
- **Unit tests for latency**: Mock Date.now() progression, verify console.warn if >1s
- **Unit tests for metadata extraction**: Test with complete metadata, partial metadata, undefined metadata
- **Backward compatibility**: Ensure existing notification-service tests (trigger map defaults match old includes() behavior for known events)
- **Use `vi.hoisted()` mock pattern** for any module-level mocks
- **Use `vi.spyOn(console, "log").mockImplementation(() => {})` for console assertions**

### Project Structure Notes

**Files to modify:**
- `packages/core/src/notification-service.ts` — refactor event classification, add actionable context, info filtering, latency tracking
- `packages/core/src/types.ts` — add `triggerMap` to `NotificationServiceConfig`, optionally add `lastLatencyMs` to `NotificationStatus`

**Files to verify (read-only):**
- `packages/core/src/blocked-agent-detector.ts` — check if `agent.offline` can be published
- `packages/core/src/event-publisher.ts` — verify published event metadata keys
- `packages/core/src/event-bus-integration.ts` — understand event subscription patterns
- `packages/cli/src/lib/wire-detection.ts` — confirm Story 3-1 wiring is in place

**Test files to create/modify:**
- `packages/core/__tests__/notification-service.test.ts` — add tests for trigger map, actionable context, info filtering, latency

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.2 (lines 646-662)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR19 (event routing), FR21 (backlog alerts)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Decision 5: Notification System (lines 764-858)]
- [Source: packages/core/src/notification-service.ts — subscribeToEvents (252-273), getPriorityFromEventType (278-293), getTitleFromEventType (298-315), getMessageFromEventType (320-337)]
- [Source: packages/core/src/types.ts — NotificationServiceConfig (1681-1694), NotificationStatus (1625-1634), EventBusEvent (1460-1469), Notification (1593-1610)]
- [Source: packages/core/src/blocked-agent-detector.ts — publishes agent.blocked, agent.resumed]
- [Source: packages/core/src/event-publisher.ts — publishStoryEvent, publishAgentEvent with metadata]
- [Source: _bmad-output/implementation-artifacts/3-1-notification-routing-channel-configuration.md — previous story learnings, file list, ESLint hook warning]
- [Source: _bmad-output/project-context.md — Promise.allSettled, error isolation, ESM rules, testing rules]

### Limitations (Deferred Items)

1. `agent.offline` event publisher
   - Status: Deferred - BlockedAgentDetector uses single inactivity threshold, no "offline" distinction
   - Requires: Second threshold tier in BlockedAgentDetector or new health monitor
   - Epic: Epic 4 (Self-Healing Operations — Story 4-4: Health Monitoring & Configurable Thresholds)
   - Current: `agent.offline` trigger exists in DEFAULT_TRIGGER_MAP with `warning` priority. When a publisher emits this event in the future, notifications will work automatically.

2. `eventbus.backlog` event publisher
   - Status: Deferred - EventBus does not currently publish backlog health events
   - Requires: EventBus health monitoring
   - Epic: Epic 4 (Self-Healing Operations — Story 4-4)
   - Current: `eventbus.backlog` trigger exists in DEFAULT_TRIGGER_MAP with `critical` priority. Ready for when EventBus self-monitoring is added.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- ESLint hook blocked incremental edits (imports/constants without usage) — resolved by doing complete file rewrite via Write tool
- `pnpm vitest run` not found — used `cd packages/core && pnpm test -- --run` instead

### Completion Notes List

- Replaced hardcoded `includes()` event classification with configurable trigger map (exact-match lookup)
- Added `NotificationTrigger` interface to types.ts, `triggerMap` to config, `lastLatencyMs` to status
- Info-priority events (story.completed, story.started, story.assigned, agent.resumed) are deduped then console.log only — not sent to plugins
- Each notification includes actionable CLI suggestions (e.g., `Run: ao status <agentId>`)
- Delivery latency measured and warned if >1s
- 50 tests passing (27 existing + 23 new), 0 regressions
- Build and typecheck pass across all 26 packages

### Code Review Fixes Applied

- **H1**: Removed `notification.backlog` from DEFAULT_TRIGGER_MAP — it is self-published by NotificationService and re-consuming it caused infinite recursive loop (regression from old code where it was safely ignored)
- **M1**: Added dedup check for info events before logging — prevents log spam from rapid duplicate events (original task 3.4 requirement)
- **M2**: Removed unused `_NotificationPreferences` import hack from test file
- **M3**: Changed `String()` casts to `typeof === "string"` guards in `buildMessage()` — prevents `[object Object]` in notification messages from non-string metadata
- **M4**: Added test for `eventbus.backlog` trigger map classification (was untested)
- **L1**: Added test for `story.assigned` info log-only (was the only untested info event)
- **L2**: Strengthened latency assertion with `toBeGreaterThanOrEqual(0)` (was only checking typeof)

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/core/src/types.ts` | Modified | Added `NotificationTrigger` interface, `triggerMap` to config, `lastLatencyMs` to status |
| `packages/core/src/notification-service.ts` | Modified (rewrite) | Replaced hardcoded event classification with trigger map, added actionable context, info log-only, latency measurement |
| `packages/core/__tests__/notification-service.test.ts` | Modified | Added 21 new tests in "Event-Driven Notification Triggers (Story 3-2)" describe block |
| `_bmad-output/implementation-artifacts/3-2-event-driven-notification-triggers.md` | Created | Story file with tasks, ACs, dev notes |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Updated story status: backlog → ready-for-dev → in-progress |
