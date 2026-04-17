# Story 58.6: Provider Health & Graceful Degradation

Status: done

## Story

As a project manager,
I want provider health monitored with automatic circuit breaking and graceful fallback to the raw provider on failure,
so that sessions continue uninterrupted even when the session enhancement provider is unavailable.

## Acceptance Criteria

1. **AC1 — Provider health polling**: A `ProviderHealthMonitor` class periodically polls the active `SessionEnhancementProvider.healthCheck()` method at a configurable interval (default: 30s). Results feed into a circuit breaker via `CircuitBreakerManager.getBreaker("provider")`.
2. **AC2 — Circuit breaker integration**: When `ProviderHealth.healthy === false` is returned 3 consecutive times (configurable), the circuit breaker trips to OPEN state. When OPEN, no provider calls are attempted; sessions use `RawProvider` instead. After a configurable cool-down (default: 60s), the breaker enters HALF-OPEN and probes with one health check — if healthy, it closes; if unhealthy, it re-opens.
3. **AC3 — Graceful fallback on failure**: During session spawn (`session-manager.ts`), before calling provider methods (`install`, `configure`, `enhance`), the system checks `breaker.allowRequest()`. If OPEN, it logs a warning and falls back to `RawProvider` for that session. The session metadata records `ao:providerFallback: true`.
4. **AC4 — Recovery and restoration**: When the circuit breaker transitions from OPEN → CLOSED, the system logs a recovery event. No automatic re-enhancement of existing sessions — only new sessions benefit from the restored provider.
5. **AC5 — Health check rule integration**: Provider health is wired into the existing `HealthCheckRulesEngine` as a `CustomHealthCheckRule` named `"session-enhancement-provider"`. The rule calls the provider's `healthCheck()` and maps `ProviderHealth` to `ComponentHealth` (`healthy` → `"healthy"`, `!healthy` → `"unhealthy"`). This integrates with the existing health check dashboard and SSE notifications.
6. **AC6 — Config schema extension**: The `SessionEnhancementConfig` type is extended with optional `healthCheckIntervalMs` (default: 30000), `failureThreshold` (default: 3), `openDurationMs` (default: 60000). Corresponding Zod schema in `config.ts` updated.
7. **AC7 — Unit tests**: Comprehensive vitest tests covering: health polling triggers breaker trip after N failures, recovery on successful probe, fallback to RawProvider when breaker is OPEN, health check rule integration, config parsing with new fields, factory isolation.

## Tasks / Subtasks

- [x] Task 1: Extend config schema (AC: #6)
  - [x] 1.1 Add `ProviderHealthConfig` interface to `types.ts`: `{ healthCheckIntervalMs?: number; failureThreshold?: number; openDurationMs?: number }`
  - [x] 1.2 Extend `SessionEnhancementConfig` in `types.ts` with optional `health?: ProviderHealthConfig`
  - [x] 1.3 Update `SessionEnhancementConfigSchema` in `config.ts` with Zod `.extend({ health: ... })` and defaults

- [x] Task 2: Create ProviderHealthMonitor module (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `packages/core/src/provider-health.ts`
  - [x] 2.2 Implement `ProviderHealthMonitor` class with `start()` / `stop()` lifecycle
  - [x] 2.3 Health polling loop: call `provider.healthCheck()`, feed into `breaker.recordSuccess()` / `breaker.recordFailure()`
  - [x] 2.4 `isProviderAvailable(): boolean` — delegates to `breaker.allowRequest()`
  - [x] 2.5 `getStatus(): ProviderHealthStatus` — returns current breaker state + last check result
  - [x] 2.6 Factory function: `createProviderHealthMonitor(config)` returning `ProviderHealthMonitor`

- [x] Task 3: Health check rule integration (AC: #5)
  - [x] 3.1 Add `createProviderHealthRule(provider)` function in `provider-health.ts`
  - [x] 3.2 Returns `CustomHealthCheckRule` that calls `provider.healthCheck()` and maps to `ComponentHealth`
  - [x] 3.3 Rule registered with `component: "session-enhancement-provider"`, `critical: false`

- [x] Task 4: Wire into session manager spawn flow (AC: #3)
  - [x] 4.1 In `session-manager.ts` spawn path: import `isProviderAvailable` from provider health module
  - [x] 4.2 Before calling provider methods: check `isProviderAvailable()`, if false → log warning, use RawProvider
  - [x] 4.3 Set session metadata `ao:providerFallback: "true"` when fallback occurs

- [x] Task 5: Export from index.ts (AC: #1)
  - [x] 5.1 Export `createProviderHealthMonitor`, `createProviderHealthRule` from `index.ts`
  - [x] 5.2 Export `ProviderHealthMonitor` and `ProviderHealthStatus` types from `index.ts`

- [x] Task 6: Unit tests (AC: #7)
  - [x] 6.1 Create `packages/core/src/__tests__/provider-health.test.ts`
  - [x] 6.2 Test: health polling records successes and failures
  - [x] 6.3 Test: breaker trips after N consecutive failures
  - [x] 6.4 Test: breaker recovers on successful probe after cool-down
  - [x] 6.5 Test: `isProviderAvailable()` returns false when breaker is OPEN
  - [x] 6.6 Test: health check rule maps ProviderHealth to ComponentHealth correctly
  - [x] 6.7 Test: config parsing with new health fields and defaults
  - [x] 6.8 Test: factory isolation (each monitor has independent state)

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

Per-project circuit breaker isolation (each project having its own provider breaker instance) is a future enhancement — current implementation uses a single breaker keyed on `"provider"`.

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
- [x] `SessionEnhancementProvider.healthCheck()` — existing in types.ts, returns `ProviderHealth`
- [x] `CircuitBreaker.allowRequest()` — existing, returns boolean for request gating
- [x] `CircuitBreaker.recordSuccess()` / `recordFailure()` — existing, feeds breaker state
- [x] `CircuitBreakerManager.getBreaker(serviceName)` — existing, creates/retrieves named breakers
- [x] `HealthCheckRulesEngine.registerRule(rule)` — existing, adds custom health check rules
- [x] `RawProvider` — existing no-op provider, used as fallback

**Feature Flags:**
- Provider health monitoring is active only when a non-raw provider is configured. When `"raw"` provider is selected, no health monitoring is needed.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. All infrastructure (CircuitBreaker, CircuitBreakerManager, HealthCheckRulesEngine) already exists in core.

## Dev Notes

### Architecture Context

This story builds the reliability layer on top of the provider abstraction from stories 58-1 through 58-3 and the model routing from 58-4.

**What 58-1 through 58-3 implemented:**
- `SessionEnhancementProvider` interface with `healthCheck()` method
- `RawProvider` as the no-op fallback
- `OMCProvider` as the primary implementation
- Plugin slot system for provider discovery
- Config schema with per-project overrides

**What 58-4 implemented:**
- `ModelRoutingService` with auto-escalation on failure
- `modelRoutingService.recordFailure(sessionId, tier)` / `resetFailures(sessionId)`

**What 58-5 implemented:**
- `ModelUsageAggregator` tracking tier/token consumption per session
- `validateModelTier()` for safe tier normalization
- `captureModelUsage()` helper in completion handlers

**What 58-6 adds (THIS STORY):**
- Periodic provider health polling feeding into circuit breaker
- Automatic fallback to RawProvider when provider is unhealthy
- Health check rule integration for dashboard visibility
- Config extension for health check tuning

### Data Flow

```
Periodic Health Poll (every 30s):
  → provider.healthCheck()
  → ProviderHealth { healthy: true/false }
  → if healthy: breaker.recordSuccess()
  → if !healthy: breaker.recordFailure()
  → if 3 consecutive failures: breaker trips OPEN

Session Spawn:
  → breaker.allowRequest()?
    → YES: use configured provider (OMC/Custom)
    → NO:  log warning, use RawProvider, set ao:providerFallback=true

Circuit Recovery (after 60s cool-down):
  → breaker enters HALF-OPEN
  → next health poll: provider.healthCheck()
    → healthy: breaker closes → new sessions use provider again
    → unhealthy: breaker re-opens → continue with RawProvider
```

### Key Design Decisions

1. **Reuse existing circuit breaker**: Do NOT implement a new circuit breaker. The existing `CircuitBreakerManager.getBreaker("provider")` provides all needed state machine logic (CLOSED → OPEN → HALF-OPEN → CLOSED). Configure it with `failureThreshold: 3` and `openDurationMs: 60000`.

2. **Reuse health check rules engine**: Do NOT build a separate health monitoring system. Register provider health as a `CustomHealthCheckRule` via `createProviderHealthRule()` so it integrates with the existing `HealthCheckService` dashboard and SSE notifications.

3. **Single global breaker per provider name**: One breaker keyed on the provider name (e.g., `"provider"` or `"omc"`). Per-project breaker isolation is deferred — all projects sharing the same provider share the same breaker state.

4. **No re-enhancement of existing sessions**: When the provider recovers, only NEW sessions benefit. Already-running sessions that fell back to RawProvider continue with RawProvider for the rest of their lifecycle. This avoids complex mid-session provider switching.

5. **Fallback metadata**: Sessions that use the fallback RawProvider get `ao:providerFallback: "true"` in their metadata, enabling downstream analytics to track fallback frequency.

### Existing Infrastructure to Reuse

| Module | What to Reuse |
|--------|---------------|
| `circuit-breaker.ts` | `createCircuitBreaker(deps)` with custom config |
| `circuit-breaker-manager.ts` | `getBreaker(serviceName)` for named instances, `SILENT_LOGGER` |
| `health-check-rules.ts` | `CustomHealthCheckRule` type, `createHealthCheckRulesEngine()` |
| `health-check.ts` | `checkComponent()` integration via rules engine |
| `model-routing.ts` | `recordFailure()` / `resetFailures()` pattern (consider calling when provider fails) |
| `session-manager.ts` | Spawn flow already has provider resolution — add breaker check before provider calls |
| `service-registry.ts` | Add `registerProviderHealthMonitor` / `getProviderHealthMonitor` for global access |
| `config.ts` | `SessionEnhancementConfigSchema` — extend with `.extend({ health: ... })` |
| `types.ts` | `ProviderHealth`, `SessionEnhancementProvider`, `HealthStatus`, `ComponentHealth` |

### File Change Impact

| File | Change | Why |
|------|--------|-----|
| `packages/core/src/provider-health.ts` | NEW | ProviderHealthMonitor + createProviderHealthRule |
| `packages/core/src/types.ts` | MODIFY | Add ProviderHealthConfig, extend SessionEnhancementConfig |
| `packages/core/src/config.ts` | MODIFY | Extend SessionEnhancementConfigSchema with health sub-schema |
| `packages/core/src/session-manager.ts` | MODIFY | Add breaker check before provider calls in spawn flow |
| `packages/core/src/index.ts` | MODIFY | Export provider-health module |
| `packages/core/src/__tests__/provider-health.test.ts` | NEW | Unit tests |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { appendFile } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { ProviderHealth, SessionEnhancementProvider } from "./types.js"`

### TypeScript Conventions (MUST follow)

- ESM modules — `"type": "module"` in package.json
- Strict mode — `"strict": true` in tsconfig
- No `any` — use `unknown` + type guards
- No non-null assertions (`!`) — use guards
- Semicolons, double quotes, 2-space indent (enforced by Prettier)

### Testing Standards

- **Framework**: vitest
- **Location**: `src/__tests__/*.test.ts` co-located with source
- **Assertion style**: `expect(x).toBe(y)` — no `expect(true).toBe(true)`
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in package
- **File fixtures**: Use `os.tmpdir()` for JSONL test files, clean up in afterEach
- **Mock provider**: Create `createMockProvider()` helper returning `SessionEnhancementProvider` with controllable `healthCheck()` behavior

### Anti-Patterns to Avoid

- **DO NOT** implement a new circuit breaker — reuse `CircuitBreakerManager.getBreaker()`
- **DO NOT** build a separate health monitoring system — reuse `HealthCheckRulesEngine`
- **DO NOT** attempt mid-session provider switching — fallback only applies at spawn time
- **DO NOT** modify the `SessionEnhancementProvider` interface — it already has `healthCheck()`
- **DO NOT** hardcode provider names — use the configured provider name from session enhancement config
- **DO NOT** break completion handler error handling — health monitoring must never block sessions
- **DO NOT** add polling in the constructor — use `start()` / `stop()` lifecycle methods

### Previous Story Intelligence (from 58-5)

Key learnings from implementing Model Usage Tracking:
- **Factory pattern**: Use `createXxx()` factory functions returning interface types (not classes). See `createModelUsageAggregator()` pattern.
- **Lazy initialization**: Use `start()`/`stop()` lifecycle, not constructor initialization for async resources.
- **Secondary indexes**: If ProviderHealthMonitor tracks multiple providers, use `Map<string, ProviderState>` for O(1) lookups.
- **Configurable thresholds**: Make all thresholds configurable via config with sensible defaults — this was done well in model-routing.ts.
- **Test patterns**: Use `vitest` `beforeEach`/`afterEach` for setup/teardown, `vi.fn()` for mocks, real timer cleanup.

### Limitations (Deferred Items)

1. **Per-project circuit breaker isolation**
   - Status: Deferred - Future enhancement
   - Requires: Multi-tenant provider tracking with per-project breaker instances
   - Current: Single global breaker per provider name

2. **Mid-session provider switching**
   - Status: Deferred - Future enhancement
   - Requires: Session state migration and provider context transfer
   - Current: Fallback only applies at session spawn time

3. **Provider warm-up validation**
   - Status: Deferred - Future enhancement
   - Requires: Pre-flight provider validation before first session spawn
   - Current: First health check happens on the polling interval after monitor start

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 58, Story 58-6 definition, FR-P1-5, NFR-R1]
- [Source: `packages/core/src/types.ts:1227-1264` — SessionEnhancementProvider interface with healthCheck()]
- [Source: `packages/core/src/types.ts:1208-1215` — ProviderHealth interface]
- [Source: `packages/core/src/types.ts:1033-1040` — SessionEnhancementConfig]
- [Source: `packages/core/src/circuit-breaker.ts` — CircuitBreaker primitive]
- [Source: `packages/core/src/circuit-breaker-manager.ts` — Named breaker registry with lazy creation]
- [Source: `packages/core/src/health-check-rules.ts` — CustomHealthCheckRule type and rules engine]
- [Source: `packages/core/src/health-check.ts` — HealthCheckServiceImpl with rules engine integration]
- [Source: `packages/core/src/degraded-mode.ts` — DegradedModeService pattern (reference for design)]
- [Source: `packages/core/src/config.ts:87-97` — SessionEnhancementConfigSchema]
- [Source: `packages/core/src/service-registry.ts` — Global service registration pattern]
- [Source: `packages/core/src/session-manager.ts` — Spawn flow with provider resolution]
- [Source: `packages/core/src/__tests__/session-enhancement-provider.test.ts` — Existing provider test patterns]
- [Source: `CLAUDE.md` — TypeScript conventions, shell command security]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Recovery test timing issue: Circuit breaker auto-transitions OPEN→HALF-OPEN only on `getState()` call after cool-down. Fixed by using `checkNow()` for deterministic probing instead of relying on timer-based polling with fake timers.

### Completion Notes List

- All 6 tasks completed. 27 unit tests passing (expanded from 20 after code review). Zero regressions.
- Reused existing `CircuitBreaker` primitive rather than implementing a new one.
- Reused existing `HealthCheckRulesEngine` via `createProviderHealthRule()` for dashboard integration.
- Single global breaker per provider name (per-project isolation deferred).
- No re-enhancement of existing sessions on recovery — only new sessions benefit.
- Circuit breaker check in session-manager uses dynamic `import()` for `service-registry.js` to avoid circular dependency at module load time.
- **Code review fixes applied:**
  - H1: Added `bootstrapProviderHealth()` to wire config values (failureThreshold, openDurationMs, healthCheckIntervalMs) to runtime breaker/monitor creation
  - H2: Fixed `createProviderHealthRule()` name collision — `name` now derives from `component` parameter instead of being hardcoded
  - M1: Added `.catch()` to `void performCheck()` in setInterval to prevent unhandled rejections
  - M2: `clearServiceRegistry()` now calls `stop()` on the registered monitor before clearing
  - M3: Added session-manager fallback integration tests verifying `ao:providerFallback` path

### File List

- `packages/core/src/types.ts` — MODIFY: Added `ProviderHealthConfig` interface, extended `SessionEnhancementConfig` with `health` field
- `packages/core/src/config.ts` — MODIFY: Added `ProviderHealthConfigSchema` Zod schema with defaults, extended `SessionEnhancementConfigSchema`
- `packages/core/src/provider-health.ts` — NEW: `ProviderHealthMonitor` class with `start()`/`stop()` lifecycle, health polling, circuit breaker integration; `createProviderHealthRule()` for health check rules engine; `bootstrapProviderHealth()` for config-to-runtime wiring
- `packages/core/src/session-manager.ts` — MODIFY: Added circuit breaker check before provider install in spawn flow, fallback to `RawProvider` with `ao:providerFallback` metadata tag
- `packages/core/src/service-registry.ts` — MODIFY: Added `registerProviderHealthMonitor()` / `getProviderHealthMonitor()` for global access; `clearServiceRegistry()` now stops monitor timer
- `packages/core/src/index.ts` — MODIFY: Exported `createProviderHealthMonitor`, `bootstrapProviderHealth`, `createProviderHealthRule`, `ProviderHealthMonitor`, `ProviderHealthStatus`
- `packages/core/src/__tests__/provider-health.test.ts` — NEW: 27 unit tests covering all 7 acceptance criteria plus code review fixes (bootstrap, registry cleanup, fallback integration)
