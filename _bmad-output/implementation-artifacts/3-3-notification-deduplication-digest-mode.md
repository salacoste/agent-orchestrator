# Story 3.3: Notification Deduplication & Digest Mode

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want duplicate notifications suppressed and non-urgent alerts batched into digests,
so that I'm not overwhelmed by repeated alerts for the same issue.

## Acceptance Criteria

1. **AC1 — Entity-based sliding window deduplication:** Deduplication key changes from `{eventId}:{eventType}` to `{eventType}:{entityId}` where entityId is extracted from `metadata.storyId` or `metadata.agentId`. Same type + same entity within a configurable window → suppressed. This prevents repeated notifications for the same blocked agent or same blocked story, even across different event bus publishes.

2. **AC2 — Per-type configurable dedup windows:** Each event type can have its own dedup window (5-30 min) instead of a single global `dedupWindowMs`. Defaults:
   - `agent.blocked` → 5 min
   - `conflict.detected` → 10 min
   - `agent.offline` → 5 min
   - `eventbus.backlog` → 10 min
   - `story.blocked` → 5 min
   - Info events (`story.completed`, `story.started`, `story.assigned`, `agent.resumed`) → 5 min (unchanged)
   - Global `dedupWindowMs` remains as fallback for any type not in the per-type map.

3. **AC3 — Digest mode for medium-priority notifications:** Medium-priority events are accumulated in a digest buffer instead of sending immediately. The buffer flushes every 30 minutes (configurable via `digestIntervalMs`). Each flush produces a single batched notification summarizing all accumulated events. If no events accumulated, no digest is sent. Digest flush uses the same plugin delivery pipeline as immediate notifications.

4. **AC4 — Notification history:** In-memory ring buffer stores the last 1000 notifications (configurable via `historyMaxEntries`). Entries older than 7 days (configurable via `historyRetentionDays`) are pruned on access. History is queryable via `getHistory(filter?)` method on NotificationService interface. Filter supports `since` (Date), `eventType` (string), and `priority` (string).

5. **AC5 — Performance:** Dedup check completes in <5ms (in-memory Map lookup). Digest flush adds no latency to immediate notifications. History query returns in <10ms for 1000 entries.

6. **AC6 — Comprehensive test coverage:** Tests verify:
   - Entity-based dedup key format (`{eventType}:{entityId}`)
   - Per-type dedup windows respected
   - Same entity suppressed, different entity passes through
   - Digest buffer accumulates medium-priority events
   - Digest flush sends batched notification after interval
   - Empty digest produces no notification
   - History stores notifications up to max entries
   - History prunes entries older than retention period
   - History filter by eventType, priority, since
   - Backward compatibility: existing tests still pass

## Tasks / Subtasks

- [x] Task 1: Refactor dedup key format to entity-based (AC: #1)
  - [x] 1.1 Change `DedupKey` interface: replace `eventId` field with `entityId: string`
  - [x] 1.2 Add `extractEntityId(metadata)` private method: returns `metadata.storyId ?? metadata.agentId ?? "unknown"`
  - [x] 1.3 Change dedup key from `${eventId}:${eventType}` to `${eventType}:${entityId}` in both `send()` and `subscribeToEvents()` info-event path
  - [x] 1.4 Update `cleanExpiredDedupKeys()` to use new key format

- [x] Task 2: Implement per-type dedup windows (AC: #2)
  - [x] 2.1 Add `dedupWindowByType?: Record<string, number>` to `NotificationServiceConfig` in types.ts
  - [x] 2.2 Define `DEFAULT_DEDUP_WINDOWS` constant with per-type defaults from AC2
  - [x] 2.3 Add `getDedupWindow(eventType)` private method: checks per-type map, falls back to global `dedupWindowMs`
  - [x] 2.4 Replace all `this.config.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS` with `this.getDedupWindow(eventType)`

- [x] Task 3: Implement digest mode for medium-priority (AC: #3)
  - [x] 3.1 Add `"medium"` to `NotificationPriority` type in types.ts (currently only `"critical" | "warning" | "info"`)
  - [x] 3.2 Add `digestIntervalMs?: number` to `NotificationServiceConfig` in types.ts (default: 1800000 = 30 min)
  - [x] 3.3 Add `digestBuffer: Notification[]` private array to NotificationServiceImpl
  - [x] 3.4 Add digest timer (`setInterval`) in constructor, cleared in `close()`
  - [x] 3.5 In `subscribeToEvents()`, route medium-priority events to digest buffer instead of `send()`
  - [x] 3.6 Implement `flushDigest()` private method: if buffer non-empty, build summary notification, call `send()`, clear buffer
  - [x] 3.7 Summary notification format: title "Digest: N notifications", message lists event types and counts

- [x] Task 4: Implement notification history ring buffer (AC: #4)
  - [x] 4.1 Add `NotificationHistoryEntry` interface to types.ts: `{ notification: Notification; deliveredAt: string; deliveredPlugins: string[] }`
  - [x] 4.2 Add `NotificationHistoryFilter` interface to types.ts: `{ since?: Date; eventType?: string; priority?: string }`
  - [x] 4.3 Add `getHistory(filter?: NotificationHistoryFilter): NotificationHistoryEntry[]` to `NotificationService` interface in types.ts
  - [x] 4.4 Add `historyMaxEntries?: number` (default: 1000) and `historyRetentionDays?: number` (default: 7) to `NotificationServiceConfig`
  - [x] 4.5 Add `history: NotificationHistoryEntry[]` private array to NotificationServiceImpl
  - [x] 4.6 After successful `send()`, push entry to history; if over max, shift oldest
  - [x] 4.7 Implement `getHistory(filter?)`: prune expired entries, then apply filter predicates
  - [x] 4.8 Clear history in `close()`

- [x] Task 5: Write comprehensive tests (AC: #6)
  - [x] 5.1 Entity-based dedup tests: same entity suppressed, different entity passes, key format verified (5 tests)
  - [x] 5.2 Per-type window tests: short window expires, long window still active, fallback to global, user config override (5 tests)
  - [x] 5.3 Digest buffer tests: medium events buffered not sent, flush sends summary, empty flush no-op, close clears buffer (4 tests)
  - [x] 5.4 History tests: entries stored, max cap enforced, retention prune works, filter by type/priority/since, clear on close, returns copy (8 tests)
  - [x] 5.5 Backward compatibility: existing 50 tests still pass (1 test updated for entity-based dedup in backlog threshold test)
  - [x] 5.6 Performance test: dedup check timing assertion (< 5ms for 1000 entries) (1 test)

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
- [x] `NotificationService.send(notification)` — existing, used for digest flush and immediate delivery
- [x] `NotificationService.getStatus()` — existing, returns NotificationStatus
- [x] `NotificationService.close()` — existing, clears digest timer, history, and digest buffer
- [x] `NotificationService.getHistory(filter?)` — NEW, added to interface and implemented
- [x] `NotificationServiceConfig.eventBus` — existing
- [x] `NotificationServiceConfig.plugins` — existing
- [x] `NotificationServiceConfig.dedupWindowMs` — existing, now global fallback
- [x] `NotificationServiceConfig.dedupWindowByType` — NEW, added to types.ts
- [x] `NotificationServiceConfig.digestIntervalMs` — NEW, added to types.ts
- [x] `NotificationServiceConfig.historyMaxEntries` — NEW, added to types.ts
- [x] `NotificationServiceConfig.historyRetentionDays` — NEW, added to types.ts
- [x] `EventBus.subscribe(callback)` — existing, already subscribed in constructor
- [x] `NotificationPlugin.send(notification)` — existing, called for digest flush
- [x] Verify each method exists in `packages/core/src/types.ts`

**Feature Flags:**
- [x] No new feature flags needed — all changes are additive to existing interfaces
- [x] Use pattern from packages/core/INTERFACE_VALIDATION_CHECKLIST.md

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## CLI Integration Testing (if applicable)

Not applicable for this story. The `ao notifications history` CLI command is a future story (Epic 5). This story adds the `getHistory()` method to the core service interface only.

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story enhances the **existing** `NotificationServiceImpl` in `core/src/notification-service.ts` with three new capabilities:

1. **Entity-based dedup** — Changes dedup key from event-id-based to entity-based, so repeated alerts about the same agent or story are suppressed even across different event publishes
2. **Per-type dedup windows** — Each event type gets its own configurable TTL instead of one global window
3. **Digest mode** — Medium-priority events accumulate in a buffer and flush as a single summary notification on an interval
4. **Notification history** — In-memory ring buffer for queryable notification history

```
EventBus ──subscribe──► NotificationService.subscribeToEvents()
                              │
                        ┌─────▼──────────┐
                        │  Trigger Map    │  (from Story 3-2)
                        │  Lookup         │
                        └─────┬──────────┘
                              │
                    ┌─────────┼─────────────────┐
                    │         │                  │
              priority=info   │           priority=medium
                    │         │                  │
              Dedup check  priority=             Dedup check
              console.log  critical|warning      Digest buffer
                           │                     │
                      Dedup check           Timer flush
                      (entity-based)        every 30 min
                           │                     │
                      Per-type TTL          Build summary
                           │                notification
                      this.send()               │
                           │              this.send()
                      Record to                  │
                      history              Record to
                                           history
```

### What Already Exists (DO NOT REINVENT)

| Module | File | Key Methods | Status |
|--------|------|-------------|--------|
| NotificationServiceImpl | `core/src/notification-service.ts` | send(), subscribeToEvents(), getTrigger(), buildMessage(), cleanExpiredDedupKeys() | MODIFY |
| NotificationServiceConfig | `core/src/types.ts:1691-1706` | eventBus, plugins, dedupWindowMs, triggerMap | EXTEND — add new config fields |
| NotificationService interface | `core/src/types.ts:1654-1680` | send(), getStatus(), getDLQ(), retryDLQ(), close() | EXTEND — add getHistory() |
| NotificationStatus | `core/src/types.ts:1625-1636` | queueDepth, dedupCount, dlqSize, lastLatencyMs | READ ONLY |
| DedupKey (private) | `core/src/notification-service.ts:66-70` | eventId, eventType, expiresAt | MODIFY — eventId → entityId |
| DEFAULT_TRIGGER_MAP | `core/src/notification-service.ts:45-55` | 9 event types mapped | READ ONLY |
| Existing tests | `core/__tests__/notification-service.test.ts` | 50 tests passing | EXTEND |

### What's MISSING (This Story Fills)

| Gap | Description |
|-----|-------------|
| Event-id-based dedup | Current key `{eventId}:{eventType}` doesn't suppress repeat alerts for same entity — every event bus publish has a unique eventId |
| Single global dedup window | All events share one 5-min window — `conflict.detected` should have 10 min, `eventbus.backlog` should have 10 min |
| No digest mode | Medium-priority events don't exist yet — no batching mechanism |
| No notification history | No way to query past notifications — needed for `ao notifications history` CLI (Epic 5) |

### Current Dedup Implementation (Lines 128-150)

```typescript
// CURRENT — REPLACE dedup key format:
const dedupKey = `${notification.eventId}:${notification.eventType}`;
// Problem: eventId is unique per publish, so same agent blocking twice generates
// two different keys and both notifications go through

// TARGET:
const entityId = this.extractEntityId(notification.metadata);
const dedupKey = `${notification.eventType}:${entityId}`;
// Now: same agent blocking twice → same key → second one suppressed
```

### Current DedupKey Interface (Lines 66-70)

```typescript
// CURRENT:
interface DedupKey {
  eventId: string;    // CHANGE to entityId
  eventType: string;
  expiresAt: number;  // CHANGE to use per-type window
}
```

### Entity ID Extraction Pattern

```typescript
private extractEntityId(metadata: Record<string, unknown>): string {
  if (typeof metadata.storyId === "string" && metadata.storyId) {
    return metadata.storyId;
  }
  if (typeof metadata.agentId === "string" && metadata.agentId) {
    return metadata.agentId;
  }
  return "unknown";
}
```

### Per-Type Dedup Window Pattern

```typescript
const DEFAULT_DEDUP_WINDOWS: Record<string, number> = {
  "agent.blocked": 300000,       // 5 min
  "story.blocked": 300000,       // 5 min
  "agent.offline": 300000,       // 5 min
  "conflict.detected": 600000,   // 10 min
  "eventbus.backlog": 600000,    // 10 min
};

private getDedupWindow(eventType: string): number {
  // User config overrides > per-type defaults > global fallback
  const userOverride = this.config.dedupWindowByType?.[eventType];
  if (userOverride !== undefined) return userOverride;
  return DEFAULT_DEDUP_WINDOWS[eventType] ?? (this.config.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS);
}
```

### Digest Mode Pattern

```typescript
private digestBuffer: Notification[] = [];
private digestTimer: ReturnType<typeof setInterval> | null = null;

// In constructor:
const digestInterval = config.digestIntervalMs ?? 1800000; // 30 min
this.digestTimer = setInterval(() => {
  this.flushDigest().catch((err) => {
    console.error("[notification] Digest flush error:", err);
  });
}, digestInterval);

// In subscribeToEvents() — add medium-priority branch:
if (trigger.priority === "medium") {
  const notification: Notification = { /* ... */ };
  this.digestBuffer.push(notification);
  return;
}

private async flushDigest(): Promise<void> {
  if (this.digestBuffer.length === 0) return;

  const buffered = this.digestBuffer.splice(0);
  const typeCounts = new Map<string, number>();
  for (const n of buffered) {
    typeCounts.set(n.eventType, (typeCounts.get(n.eventType) ?? 0) + 1);
  }

  const summary = Array.from(typeCounts.entries())
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const digestNotification: Notification = {
    eventId: `digest-${Date.now()}`,
    eventType: "notification.digest",
    priority: "warning",
    title: `Digest: ${buffered.length} notifications`,
    message: summary,
    metadata: { digestCount: buffered.length, types: Object.fromEntries(typeCounts) },
    timestamp: new Date().toISOString(),
  };

  await this.send(digestNotification);
}

// In close():
if (this.digestTimer) {
  clearInterval(this.digestTimer);
  this.digestTimer = null;
}
this.digestBuffer = [];
```

### Notification History Pattern

```typescript
private history: NotificationHistoryEntry[] = [];

// After successful send() — before return:
this.history.push({
  notification,
  deliveredAt: new Date().toISOString(),
  deliveredPlugins: deliveredPlugins,
});
const maxEntries = this.config.historyMaxEntries ?? 1000;
if (this.history.length > maxEntries) {
  this.history.splice(0, this.history.length - maxEntries);
}

getHistory(filter?: NotificationHistoryFilter): NotificationHistoryEntry[] {
  // Prune expired entries first
  const retentionMs = (this.config.historyRetentionDays ?? 7) * 86400000;
  const cutoff = Date.now() - retentionMs;
  this.history = this.history.filter(
    (e) => new Date(e.deliveredAt).getTime() >= cutoff
  );

  if (!filter) return [...this.history];

  return this.history.filter((entry) => {
    if (filter.since && new Date(entry.deliveredAt) < filter.since) return false;
    if (filter.eventType && entry.notification.eventType !== filter.eventType) return false;
    if (filter.priority && entry.notification.priority !== filter.priority) return false;
    return true;
  });
}

// In close():
this.history = [];
```

### Anti-Patterns to Avoid

- **Do NOT use Redis** — in-memory only for this story (architecture mentions Redis but project uses flat files)
- **Do NOT add `notification.digest` to DEFAULT_TRIGGER_MAP** — digest is self-published, same pattern as `notification.backlog` exclusion (Story 3-2 H1 fix)
- **Do NOT break existing dedup for info events** — info events in `subscribeToEvents()` also need entity-based keys
- **Do NOT use `exec()` for shell commands** — always `execFile()` with timeouts
- **Do NOT modify wire-detection.ts** — Story 3-1 already wired everything
- **Do NOT use `String()` for metadata extraction** — use `typeof === "string"` guards (Story 3-2 M3 fix)
- **Do NOT combine import additions with usage in separate edits** — ESLint hook blocks split edits (Story 3-1 learning)
- **Do NOT use `setInterval` without clearing in `close()`** — memory leak risk (CLAUDE.md common mistake)
- **Do NOT use `on("exit")` instead of `once("exit")`** — for one-time handlers (CLAUDE.md)

### Key Implementation Constraints

- **Modify, don't replace**: Extend existing methods in `NotificationServiceImpl`. Keep the class structure.
- **Backward compatible**: All new config fields are optional with sensible defaults. Existing behavior unchanged when no new config provided.
- **Minimal types.ts changes**: Add new fields to `NotificationServiceConfig`, add `getHistory()` to `NotificationService` interface, add `NotificationHistoryEntry` and `NotificationHistoryFilter` types.
- **Test existing tests still pass**: The 50 existing tests must continue passing. Entity-based dedup changes the key format but the test mocks provide unique eventIds anyway, so tests should still pass.
- **ESLint compliance**: Use `// eslint-disable-next-line no-console` for intentional console calls.

### Cross-Story Dependencies

- **Story 3-1 (done)**: Wired NotificationService into CLI, created plugin adapters, routing preferences.
- **Story 3-2 (done)**: Added configurable trigger map, info log-only filtering, actionable context, delivery latency. **Key learnings**: notification.backlog self-referential loop, metadata type safety with `typeof` guards, ESLint split-edit workaround.
- **Epic 4 (backlog)**: Self-healing operations will add circuit breaker, error classification. May add medium-priority event publishers.
- **Epic 5 (backlog)**: CLI `ao notifications history` command will consume `getHistory()`.

### Previous Story Intelligence (from Stories 3-1 and 3-2)

**Learnings to apply:**
1. **ESLint hook blocks split edits** — combine import additions with usage in a single Edit operation
2. **Rebuild packages after modifying types.ts** — run `pnpm build` before `pnpm typecheck`
3. **notification.backlog is self-published** — exclude self-published events from trigger map (Story 3-2 H1). Apply same pattern: do NOT add `notification.digest` to trigger map.
4. **Metadata type safety** — use `typeof metadata.storyId === "string"` not `String(metadata.storyId)` (Story 3-2 M3)
5. **Info events are deduped then logged** — dedup prevents log spam (Story 3-2 M1). This story changes the dedup KEY format but keeps the same dedup-before-log pattern.
6. **Test pattern**: Use `vi.fn()` for mock plugins, `vi.spyOn(console, "log").mockImplementation(() => {})` for console assertions, `vi.useFakeTimers()` for timer-based tests (digest flush).
7. **50 existing tests** — all must continue passing after changes.

### NotificationPriority Type Change

Current type in types.ts (search for `NotificationPriority`):
```typescript
export type NotificationPriority = "critical" | "warning" | "info";
```
Must change to:
```typescript
export type NotificationPriority = "critical" | "warning" | "medium" | "info";
```
This is a non-breaking addition — existing code only uses "critical", "warning", "info".

### Testing Strategy

- **Entity-based dedup**: Two events with same `eventType` + same `storyId` but different `eventId` → second is suppressed. Two events with same `eventType` but different `storyId` → both go through.
- **Per-type windows**: Use `vi.useFakeTimers()`. Advance time past short window (5 min) → dedup expired for that type. Advance less than long window (10 min) → still suppressed for that type.
- **Digest mode**: Send medium-priority event → verify `plugin.send()` NOT called. Advance timer past 30 min → verify `plugin.send()` called with summary notification. Empty buffer → no send.
- **History**: Send 3 notifications → `getHistory()` returns 3 entries. Send 1001 → only 1000 in history. Set retention to 0 days → all pruned. Filter by eventType → only matching returned.
- **Backward compatibility**: Run all 50 existing tests unchanged.
- **Use `vi.hoisted()` mock pattern** for any module-level mocks.

### Project Structure Notes

**Files to modify:**
- `packages/core/src/notification-service.ts` — entity-based dedup, per-type windows, digest mode, history
- `packages/core/src/types.ts` — add `"medium"` to NotificationPriority, new config fields, new interfaces, getHistory()

**Files to verify (read-only):**
- `packages/core/src/types.ts` — current NotificationPriority, NotificationServiceConfig, NotificationService interface
- `packages/core/__tests__/notification-service.test.ts` — understand existing test patterns

**Test files to modify:**
- `packages/core/__tests__/notification-service.test.ts` — add tests for entity dedup, per-type windows, digest, history

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.3 (lines 665-682)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Decision 5: Notification System, Deduplication Strategy (lines 764-1171)]
- [Source: _bmad-output/implementation-artifacts/3-2-event-driven-notification-triggers.md — Code Review Fixes, Limitations, Dev Agent Record]
- [Source: packages/core/src/notification-service.ts — DedupKey (66-70), send() dedup (128-150), subscribeToEvents() (280-336), cleanExpiredDedupKeys() (507-519)]
- [Source: packages/core/src/types.ts — NotificationServiceConfig (1691-1706), NotificationService (1654-1680), NotificationStatus (1625-1636)]
- [Source: _bmad-output/project-context.md — Promise.allSettled, error isolation, ESM rules, testing rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- ESLint hook blocks split imports — combined import + usage in single Write tool operation (same as Story 3-2 learning)
- Backlog threshold test needed entity metadata — existing test used same eventType with no metadata, which now maps to same entity "unknown" under entity-based dedup. Fixed by adding unique `storyId` to each test notification.
- Linter auto-removed unnecessary parentheses in `getDedupWindow()` return statement

### Completion Notes List

- Changed dedup key format from `{eventId}:{eventType}` to `{eventType}:{entityId}` — entity extracted from `metadata.storyId` or `metadata.agentId`
- Added `extractEntityId()` with `typeof` guards (Story 3-2 M3 pattern)
- Added per-type dedup windows: `DEFAULT_DEDUP_WINDOWS` constant + `getDedupWindow()` method with 3-tier lookup (user config → per-type default → global fallback)
- Added `"medium"` to `NotificationPriority` type
- Implemented digest mode: `digestBuffer` accumulates medium-priority events, `flushDigest()` runs on configurable interval, produces summary notification
- Implemented notification history: in-memory ring buffer with configurable max entries (1000) and retention (7 days), queryable via `getHistory(filter?)`
- Added `NotificationHistoryEntry`, `NotificationHistoryFilter` interfaces to types.ts
- Added `getHistory()` to `NotificationService` interface
- Added config fields: `dedupWindowByType`, `digestIntervalMs`, `historyMaxEntries`, `historyRetentionDays`
- Digest timer properly cleared in `close()` — no memory leak
- 73 tests passing (50 existing + 23 new), 0 regressions
- Build, typecheck, and lint pass across all 26 packages

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/core/src/types.ts` | Modified | Added `"medium"` to NotificationPriority, new config fields, NotificationHistoryEntry/Filter interfaces, getHistory() to NotificationService interface |
| `packages/core/src/notification-service.ts` | Modified (rewrite) | Entity-based dedup, per-type windows, digest mode, notification history, extractEntityId(), getDedupWindow(), flushDigest(), addToHistory(), getHistory() |
| `packages/core/__tests__/notification-service.test.ts` | Modified | Added 23 new tests in 5 describe blocks (Entity-Based Dedup, Per-Type Windows, Digest Mode, History, Performance), updated backlog threshold test for entity-based dedup |
| `_bmad-output/implementation-artifacts/3-3-notification-deduplication-digest-mode.md` | Modified | Status updates, task checkboxes, dev agent record |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Story status: backlog → ready-for-dev → in-progress → review |
