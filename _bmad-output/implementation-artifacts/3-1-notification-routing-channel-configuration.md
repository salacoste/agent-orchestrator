# Story 3.1: Notification Routing & Channel Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to configure which notification channels I receive alerts on (desktop, Slack, webhook),
so that I get notified through my preferred communication tools.

## Acceptance Criteria

1. **AC1 — Notification preferences in config:** Notification preferences are configurable in `agent-orchestrator.yaml` under the existing `notifiers:` and `notificationRouting:` sections. The `notificationRouting` section maps priority levels to arrays of notifier plugin names. Configuration is validated at startup via Zod schema (already exists in `config.ts`).

2. **AC2 — Per-type routing rules:** Routing rules map notification priority to delivery targets:
   - `critical` → all configured channels (desktop + slack + webhook)
   - `warning` → primary channel only (first configured notifier)
   - `info` → log only (no push notification, console output only)
   The existing `notificationRouting` config already supports this pattern. The NotificationService must respect these rules when dispatching.

3. **AC3 — Channel enablement:** Each notifier channel is individually enabled/disabled via the `notifiers:` config section:
   - Desktop: `desktop: { plugin: desktop }` (enabled) or omitted (disabled)
   - Slack: `slack: { plugin: slack, webhook: "https://..." }` with webhook URL
   - Webhook: `webhook: { plugin: webhook, url: "https://...", headers: {...} }`
   Each notifier plugin validates its own configuration at startup and logs warnings for invalid config.

4. **AC4 — Startup config validation:** When the orchestrator starts, the NotificationService validates its configuration:
   - Warns (non-fatal) if `notificationRouting` references a plugin name not in `notifiers`
   - Warns if a notifier plugin fails `isAvailable()` check
   - Logs configured routing rules to console for transparency
   - Invalid config does NOT crash — falls back to desktop-only or no-notification mode

5. **AC5 — Plugin-based delivery via NotificationPlugin adapters:** All 4 existing notifier plugins (desktop, slack, composio, webhook) are usable as `NotificationPlugin` instances for the `NotificationService`. Desktop already has `createNotificationPlugin()` adapter. The remaining 3 need equivalent adapters that wrap the `Notifier` interface into the `NotificationPlugin` interface (`send(notification)` + `isAvailable()`).

## Tasks / Subtasks

- [x] Task 1: Create NotificationPlugin adapters for notifier plugins (AC: #5)
  - [x] 1.1 **Desktop** — verified existing `createNotificationPlugin()` in `notifier-desktop/src/index.ts`
  - [x] 1.2 **Slack** — Created `notification-plugin.ts` adapter with `createNotificationPlugin()`, exports from `index.ts`
  - [x] 1.3 **Webhook** — Created `notification-plugin.ts` adapter with `createNotificationPlugin()`, exports from `index.ts`
  - [x] 1.4 **Composio** — Created `notification-plugin.ts` adapter with `createNotificationPlugin()`, exports from `index.ts`
  - [x] 1.5 All adapters exported as named exports from each plugin's barrel export

- [x] Task 2: Wire NotificationService into wire-detection.ts (AC: #1, #2, #3, #4)
  - [x] 2.1 NotificationService created in wire-detection.ts via `createNotificationService()` from `@composio/ao-core`
  - [x] 2.2 Plugin loading via `getNotificationPlugins(config)` in `plugins.ts` — reads `config.notifiers`, instantiates factories, falls back to `config.defaults.notifiers`
  - [x] 2.3 Routing preferences converted from `Record<priority, string[]>` to `NotificationPreferences` (`{ [pattern]: "plugin1,plugin2" }`)
  - [-] 2.4 Startup validation — logs configured plugin names via `chalk.dim()`. Routing mismatch warning deferred (NotificationServiceImpl.validatePreferences handles it at runtime).
  - [x] 2.5 `notificationService` passed to `createStateConflictReconciler()` config
  - [x] 2.6 `notificationService.close()` added to cleanup function in correct teardown order
  - [x] 2.7 All wiring wrapped in try/catch (non-fatal pattern)

- [-] Task 3: Extend config loading for notification preferences (AC: #1, #4)
  - [x] 3.1 Verified existing Zod schemas for `notifiers` and `notificationRouting` work correctly
  - [-] 3.2 `notificationChannels` schema deferred — existing `notifiers` section is sufficient for MVP
  - [-] 3.3 Zod `.refine()` cross-validation deferred — runtime validation in NotificationServiceImpl handles this

- [x] Task 4: Write comprehensive tests (AC: #1-#5)
  - [x] 4.1 Unit tests for each NotificationPlugin adapter (slack: 17, webhook: 18, composio: 16 tests)
  - [x] 4.2 Unit tests for config validation via `getNotificationPlugins()` in `notification-routing.test.ts`
  - [x] 4.3 Unit tests for routing logic (plugin selection, unknown plugin warning, defaults fallback)
  - [x] 4.4 Unit tests for wire-detection integration (plugin creation from config, defaults)
  - [x] 4.5 Graceful degradation tested (unknown plugins skipped with warning, empty config works)

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
- [ ] `NotificationService.send(notification)` — sends notification to plugins
- [ ] `NotificationService.getStatus()` — returns queue/dedup/DLQ stats
- [ ] `NotificationService.getDLQ()` — returns dead letter queue
- [ ] `NotificationService.retryDLQ(id)` — retries failed notification
- [ ] `NotificationService.close()` — cleanup
- [ ] `NotificationPlugin.send(notification)` — per-plugin send
- [ ] `NotificationPlugin.isAvailable()` — per-plugin availability check
- [ ] `createNotificationService(config)` — factory function
- [ ] `loadConfig(path)` — config loading with `notifiers` and `notificationRouting`
- [ ] Verify each method exists in `packages/core/src/types.ts`

**Feature Flags:**
- [ ] List any feature flags for missing capabilities
- [ ] Use pattern from packages/core/INTERFACE_VALIDATION_CHECKLIST.md

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## CLI Integration Testing (if applicable)

Not applicable — this story adds no new CLI commands. NotificationService is wired internally within `wireDetection()`.

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story **wires** the existing `NotificationService` (fully implemented, 515 lines) into the CLI lifecycle via `wire-detection.ts`, and creates `NotificationPlugin` adapters for the 3 notifier plugins that don't have them yet (slack, webhook, composio). Desktop already has one.

```
┌──────────────────────────────────────────────────────────────────┐
│                      wireDetection()                              │
│                                                                    │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │ NotificationService  │  │ NotificationPlugin Adapters      │  │
│  │ (queue+dedup+DLQ)    │  │ ┌─────────┐ ┌───────┐ ┌──────┐ │  │
│  │                      │──│ │ desktop │ │ slack │ │ web  │ │  │
│  │ EventBus subscriber  │  │ │ (exists)│ │ (new) │ │ hook │ │  │
│  │ Route by priority    │  │ └─────────┘ └───────┘ │(new) │ │  │
│  └──────────┬───────────┘  │                       └──────┘ │  │
│             │              └──────────────────────────────────┘  │
│             │                                                    │
│  ┌──────────▼───────────────────────────────────────────────┐   │
│  │ StateConflictReconciler                                   │   │
│  │ → notificationService passed in config (enables escalation)│   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  agent-orchestrator.yaml:                                         │
│    notifiers:        { desktop: {...}, slack: {...} }             │
│    notificationRouting: { urgent: [desktop, slack], ... }         │
└──────────────────────────────────────────────────────────────────┘
```

### What Already Exists (DO NOT REINVENT)

| Module | File | Lines | Status |
|--------|------|-------|--------|
| NotificationService | `core/src/notification-service.ts` | 515 | FULLY IMPLEMENTED — queue, dedup (5min window), DLQ, retry (3 attempts), event subscription, plugin routing |
| NotificationService interface | `core/src/types.ts` | 1663-1678 | send(), getStatus(), getDLQ(), retryDLQ(), close() |
| NotificationPlugin interface | `core/src/types.ts` | 1651-1660 | send(notification), isAvailable() |
| Notification interface | `core/src/types.ts` | 1593-1610 | eventId, eventType, priority, title, message, actionUrl?, metadata?, timestamp |
| NotificationPreferences | `core/src/types.ts` | 1697-1711 | eventTypePattern → plugin names |
| NotificationServiceConfig | `core/src/types.ts` | 1681-1694 | eventBus, plugins, dlqPath?, backlogThreshold?, dedupWindowMs?, preferences? |
| Config schema | `core/src/config.ts` | 48-52, 91-106 | NotifierConfigSchema, `notifiers` + `notificationRouting` in OrchestratorConfigSchema |
| Desktop NotificationPlugin | `notifier-desktop/src/index.ts` | 148-252 | createNotificationPlugin() — ALREADY EXISTS |
| Slack Notifier | `notifier-slack/src/index.ts` | 133-187 | create() → Notifier (NO NotificationPlugin adapter yet) |
| Webhook Notifier | `notifier-webhook/src/index.ts` | 104-173 | create() → Notifier (NO NotificationPlugin adapter yet) |
| Composio Notifier | `notifier-composio/src/index.ts` | 132-277 | create() → Notifier (NO NotificationPlugin adapter yet) |
| Config example | `agent-orchestrator.yaml.example` | 86-98 | notifiers + notificationRouting sections (commented out) |
| wire-detection.ts | `cli/src/lib/wire-detection.ts` | ~321 | All event-driven services wired here — NotificationService NOT YET wired |

### What's MISSING (This Story Fills)

| Gap | Description |
|-----|-------------|
| NotificationPlugin adapters for slack/webhook/composio | Only desktop has `createNotificationPlugin()`. The other 3 only implement the old `Notifier` interface, not `NotificationPlugin`. |
| NotificationService not wired in wireDetection | `createNotificationService()` is never called in production code. The service exists but is not instantiated. |
| No config-to-plugin bridging | Config has `notifiers: { slack: { plugin: slack, webhook: "..." } }` but no code reads this and creates NotificationPlugin instances. |
| StateConflictReconciler missing notificationService | Reconciler is wired without `notificationService` in wire-detection.ts (line ~205). Escalation notifications can't be sent. |
| No startup validation logging | Config is validated by Zod but mismatches (routing → plugin name) aren't surfaced. |

### Critical: Notifier vs NotificationPlugin Interface Gap

The project has TWO notification interfaces:

1. **`Notifier`** (old, slot-based): `notify(event: OrchestratorEvent)`, `notifyWithActions(event, actions)` — used by the 8-slot plugin system
2. **`NotificationPlugin`** (new, service-based): `send(notification: Notification)`, `isAvailable()` — used by NotificationService

The adapters bridge these: convert `Notification` → `OrchestratorEvent` format, then call the existing `Notifier.notify()`.

**Desktop plugin's existing adapter pattern** (lines 148-252 of notifier-desktop):
```typescript
export function createNotificationPlugin(config?: { sound?: boolean; coalescingWindowMs?: number }): NotificationPlugin {
  const notifier = create(config); // Creates the Notifier
  return {
    name: "desktop",
    async send(notification: Notification): Promise<void> {
      const event: OrchestratorEvent = {
        type: mapPriorityToEventType(notification.priority),
        sessionId: notification.metadata?.agentId as string ?? "system",
        storyId: notification.metadata?.storyId as string ?? "",
        title: notification.title,
        message: notification.message,
        timestamp: new Date(notification.timestamp),
      };
      await notifier.notify(event);
    },
    async isAvailable(): Promise<boolean> {
      return process.platform === "darwin" || process.platform === "linux";
    },
  };
}
```

**Follow this EXACT pattern** for slack, webhook, and composio adapters.

### Priority Mapping

The epics spec says: critical → all, high → primary, medium → digest, low → log only.
But `NotificationPriority` only has 3 levels: `"critical" | "warning" | "info"`.
And `notificationRouting` config uses: `urgent`, `action`, `warning`, `info`.

**Mapping for this story:**
- epic's "critical" ≈ config's "urgent" ≈ NotificationPriority "critical" → all channels
- epic's "high" ≈ config's "action" ≈ NotificationPriority "warning" → primary channel
- epic's "medium" ≈ config's "warning" → digest (Story 3-3, not this story)
- epic's "low" ≈ config's "info" ≈ NotificationPriority "info" → log only

The existing `NotificationService.filterPluginsByPreference()` (lines 463-514) already handles plugin filtering based on preferences. This story just needs to wire the correct preferences from config.

### Anti-Patterns to Avoid

- **Do NOT create a new NotificationService** — it's fully implemented in `core/src/notification-service.ts`. Only WIRE it.
- **Do NOT modify NotificationService internals** — only extend the wiring layer.
- **Do NOT add new notification types** — all types exist in `types.ts`. Only create adapters.
- **Do NOT make notification delivery fatal** — always wrap in try/catch. Failed notifications must never crash the CLI.
- **Do NOT add Redis** — in-memory NotificationService only for this story. Redis is for Epic 4.
- **Do NOT use `exec()` for shell commands** — always `execFile()` with timeouts.
- **Do NOT use `Promise.all()` for independent plugin sends** — use `Promise.allSettled()` (per project-context.md).
- **Do NOT create a single outer try/catch for multiple notifiers** — each plugin call needs its own error isolation (per project-context.md).

### Key Implementation Constraints

- **CLI-lifetime scope**: NotificationService lives for the duration of the CLI process (same as all other services in wireDetection).
- **Backward compatibility**: All changes are additive. Existing notifier slot plugins continue working unchanged.
- **Config optional**: If no `notifiers` or `notificationRouting` config exists, NotificationService creates with empty plugins list. No notifications sent, no crash.
- **Dedup already works**: NotificationService has 5-minute dedup window. Story 3-3 extends this to configurable windows and digest mode.
- **Plugin availability**: `isAvailable()` should be forgiving — return false if not configured, not throw.

### Cross-Story Dependencies

- **Epic 2 (done)**: Provided EventBus, EventPublisher, StateConflictReconciler — this story extends wire-detection to add NotificationService
- **Story 2-5 (done)**: StateConflictReconciler accepts optional `notificationService` — this story provides it
- **Story 3-2 (backlog)**: Will subscribe to specific events and trigger notifications — depends on this story's NotificationService wiring
- **Story 3-3 (backlog)**: Will extend deduplication and add digest batching — depends on this story's infrastructure

### Epic 2 Retrospective Action Items — Relevant

| # | Action Item | Relevance |
|---|-------------|-----------|
| 1 | HIGH: Extract wireDetection into composable initializers | DIRECTLY RELEVANT — consider extracting notification wiring as `wireNotificationServices()` |
| 2 | MEDIUM: Event type taxonomy | RELEVANT — use consistent event type names for notification triggers |
| 3 | MEDIUM: Interface mock validation with `satisfies Partial<T>` | RELEVANT — apply to NotificationPlugin mock factories in tests |

### Testing Strategy

- **Unit tests** for NotificationPlugin adapters: mock `Notifier.notify()`, verify `send()` calls it with correct event format
- **Unit tests** for config validation: Zod schema validation with various notifier configs
- **Unit tests** for routing logic: mock plugins, verify correct plugins called per priority
- **Unit tests** for wire-detection integration: mock createNotificationService, verify created and passed to reconciler
- **Use `Promise.allSettled()` pattern** for plugin send tests (per project-context.md)
- **Use `vi.hoisted()` mock pattern** from existing CLI tests

### ESLint Hook Warning

The project has a post-tool-use lint hook that validates each edit in isolation. When adding a new import and its usage, **combine them in a single Edit** operation. If you add the import in one edit and the usage in a separate edit, the first edit will fail because the import appears unused.

### Project Structure Notes

**Files to create:**
- `packages/plugins/notifier-slack/src/notification-plugin.ts` — NotificationPlugin adapter for Slack
- `packages/plugins/notifier-webhook/src/notification-plugin.ts` — NotificationPlugin adapter for Webhook
- `packages/plugins/notifier-composio/src/notification-plugin.ts` — NotificationPlugin adapter for Composio
- `packages/plugins/notifier-slack/__tests__/notification-plugin.test.ts` — adapter tests
- `packages/plugins/notifier-webhook/__tests__/notification-plugin.test.ts` — adapter tests
- `packages/plugins/notifier-composio/__tests__/notification-plugin.test.ts` — adapter tests
- `packages/cli/__tests__/lib/wire-detection-notifications.test.ts` — wire-detection notification integration tests

**Files to modify:**
- `packages/plugins/notifier-slack/src/index.ts` — export createNotificationPlugin
- `packages/plugins/notifier-webhook/src/index.ts` — export createNotificationPlugin
- `packages/plugins/notifier-composio/src/index.ts` — export createNotificationPlugin
- `packages/cli/src/lib/wire-detection.ts` — add NotificationService wiring, pass to StateConflictReconciler

**Files to verify (no changes expected):**
- `packages/core/src/notification-service.ts` — verify factory works as expected
- `packages/core/src/config.ts` — verify existing Zod schema handles config correctly
- `packages/core/src/types.ts` — verify all required interfaces exist

### Limitations (Deferred Items)

1. Event-driven notification triggers
   - Status: Deferred — Story 3-2 handles event subscription logic
   - Requires: This story's NotificationService wiring as foundation
   - Epic: Story 3-2 (Event-Driven Notification Triggers)
   - Current: NotificationService subscribes to EventBus in constructor, but specific trigger rules are for 3-2

2. Notification deduplication configuration
   - Status: Deferred — Story 3-3 handles configurable dedup windows
   - Requires: This story's NotificationService wiring
   - Epic: Story 3-3 (Notification Deduplication & Digest Mode)
   - Current: Default 5-minute dedup window is already implemented

3. Digest mode batching
   - Status: Deferred — Story 3-3
   - Requires: Timer-based batching logic
   - Epic: Story 3-3
   - Current: No digest batching exists

4. Adapter utility deduplication
   - Status: Deferred — Low priority code quality improvement
   - Requires: Shared module in ao-core for mapPriority/toOrchestratorEvent
   - Epic: Epic 3 backlog or tech debt
   - Current: mapPriority() and toOrchestratorEvent() duplicated in 3 adapter files (slack, webhook, composio)

5. Redis-backed notification persistence
   - Status: Deferred — Epic 4 (Self-Healing Operations)
   - Requires: Redis infrastructure
   - Epic: Epic 4
   - Current: In-memory queue only, DLQ optionally persisted to JSONL

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3, Story 3.1 (lines 614-643)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR19, FR20, FR21, FR22 (lines 770-773)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Decision 5: Notification System (lines 764-1163)]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR-I1 (plugin load <2s), NFR-I2 (plugin isolation)]
- [Source: packages/core/src/notification-service.ts — NotificationServiceImpl (515 lines, fully implemented)]
- [Source: packages/core/src/types.ts — NotificationService (1663), NotificationPlugin (1651), Notification (1593), NotificationPreferences (1697), NotificationServiceConfig (1681)]
- [Source: packages/core/src/config.ts — NotifierConfigSchema (48-52), notificationRouting (99-104)]
- [Source: packages/plugins/notifier-desktop/src/index.ts — createNotificationPlugin() adapter (148-252)]
- [Source: packages/plugins/notifier-slack/src/index.ts — Notifier.notify() (133-187)]
- [Source: packages/plugins/notifier-webhook/src/index.ts — Notifier.notify() (104-173)]
- [Source: packages/plugins/notifier-composio/src/index.ts — Notifier.notify() (132-277)]
- [Source: packages/cli/src/lib/wire-detection.ts — non-fatal wiring pattern (83-321)]
- [Source: agent-orchestrator.yaml.example — notifiers + notificationRouting config (86-98)]
- [Source: _bmad-output/implementation-artifacts/epic-2-retrospective.md — Action items 1-4]
- [Source: _bmad-output/implementation-artifacts/2-5-state-conflict-reconciliation.md — notificationService: optional in reconciler config]
- [Source: _bmad-output/project-context.md — Promise.allSettled, error isolation, plugin patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- All 4 notifier plugins now have `createNotificationPlugin()` adapters (desktop pre-existed, slack/webhook/composio created)
- NotificationService wired into wire-detection.ts with non-fatal try/catch
- `notificationService` passed to StateConflictReconciler for conflict escalation
- Routing preferences converted from config priority keys to NotificationPreferences format
- Code review fix: `filterPluginsByPreference` now supports priority-based fallback routing
- Code review fix: `validatePreferences` warns instead of throwing on unknown plugin names

### File List

**Created:**
- `packages/plugins/notifier-slack/src/notification-plugin.ts` — NotificationPlugin adapter for Slack
- `packages/plugins/notifier-webhook/src/notification-plugin.ts` — NotificationPlugin adapter for Webhook
- `packages/plugins/notifier-composio/src/notification-plugin.ts` — NotificationPlugin adapter for Composio
- `packages/plugins/notifier-slack/src/notification-plugin.test.ts` — 17 adapter tests
- `packages/plugins/notifier-webhook/src/notification-plugin.test.ts` — 18 adapter tests
- `packages/plugins/notifier-composio/src/notification-plugin.test.ts` — 16 adapter tests
- `packages/cli/__tests__/lib/notification-routing.test.ts` — 5 plugin loading/routing tests

**Modified:**
- `packages/plugins/notifier-slack/src/index.ts` — re-export createNotificationPlugin
- `packages/plugins/notifier-webhook/src/index.ts` — re-export createNotificationPlugin
- `packages/plugins/notifier-composio/src/index.ts` — re-export createNotificationPlugin
- `packages/cli/src/lib/plugins.ts` — notifier plugin factory registry + getNotificationPlugins()
- `packages/cli/src/lib/wire-detection.ts` — NotificationService wiring, routing preferences, reconciler integration, cleanup
- `packages/core/src/notification-service.ts` — [review fix] priority-based routing fallback, warn-not-throw on invalid preferences
- `packages/core/__tests__/notification-service.test.ts` — [review fix] updated preference validation test, added priority routing tests
