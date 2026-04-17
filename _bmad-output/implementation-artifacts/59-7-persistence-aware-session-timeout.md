# Story 59.7: Persistence-Aware Session Timeout

Status: done

## Story

As a developer running enhanced agent sessions,
I want the orchestrator to extend session timeouts when the agent mapping specifies persistent execution mode and work is still in progress,
so that long-running stories (implementation, complex bugfixes) don't get marked as blocked by the inactivity detector while still actively working.

## Acceptance Criteria

1. **AC1 — `ExecutionModeTimeouts` constant**: A new constant `EXECUTION_MODE_TIMEOUT_MULTIPLIERS` is defined in a new module `session-timeout.ts`:
   ```typescript
   export const EXECUTION_MODE_TIMEOUT_MULTIPLIERS: Record<NonNullable<AgentMapping["executionMode"]>, number> = {
     standard: 1.0,
     persistent: 3.0,
     lightweight: 0.5,
   };
   ```
   Exported from `index.ts`.

2. **AC2 — `resolveSessionTimeout()` function**: A new exported function `resolveSessionTimeout(agentId, storyContext, baseConfig)` in `session-timeout.ts` that:
   - Takes the agent ID, the `StoryContext` (which has the resolved `agents` field from Story 59-6), and the base `BlockedAgentDetectorConfig`
   - Returns the effective timeout in milliseconds
   - Reads `storyContext.agents?.executionMode` — if `"persistent"`, multiplies base timeout by `EXECUTION_MODE_TIMEOUT_MULTIPLIERS.persistent` (3x)
   - If `"lightweight"`, multiplies by `EXECUTION_MODE_TIMEOUT_MULTIPLIERS.lightweight` (0.5x)
   - If `"standard"` or undefined, returns the base timeout unchanged
   - Clamps the result to MIN_TIMEOUT (1 minute) and MAX_TIMEOUT (60 minutes) using the existing constants from `blocked-agent-detector.ts`

3. **AC3 — `executionModeTimeouts` field on `BlockedAgentDetectorConfig`**: The `BlockedAgentDetectorConfig` interface gains an optional field:
   ```typescript
   /** Per-execution-mode timeout multipliers (overrides defaults). */
   executionModeTimeouts?: Partial<Record<"standard" | "persistent" | "lightweight", number>>;
   ```

4. **AC4 — Integration into `BlockedAgentDetector.getTimeoutForAgent()`**: The `getTimeoutForAgent()` method in `blocked-agent-detector.ts` gains a second parameter `storyContext?: StoryContext`. When provided, it calls `resolveSessionTimeout()` to compute the effective timeout instead of returning only the agent-type default. The call chain must be:
   - `checkBlocked()` already has agent IDs — it looks up the session to get the `storyContext`
   - Passes the story context to `getTimeoutForAgent(agentId, storyContext)`
   - If no story context available, falls back to existing agent-type-based timeout

5. **AC5 — Story context lookup in `checkBlocked()`**: Inside `BlockedAgentDetector.checkBlocked()`, before calling `getTimeoutForAgent()`, the detector attempts to get the session's story context:
   ```typescript
   let storyContext: StoryContext | undefined;
   try {
     const session = await this.sessionManager.get(agentId);
     storyContext = session?.metadata?.["ao:storyContext"]
       ? JSON.parse(session.metadata["ao:storyContext"])
       : undefined;
   } catch {
     // Story context lookup failure must not crash detection
   }
   ```
   **Alternative approach**: Store the execution mode directly in session metadata during spawn (as `ao:executionMode`) to avoid JSON parsing in the hot detection path. The spawn flow already stores metadata — add `ao:executionMode` alongside existing `ao:modelTier` and `ao:model`.

6. **AC6 — Session metadata stores execution mode**: During spawn, after agent mapping resolution (Story 59-6, session-manager.ts line 787), the resolved `executionMode` is stored in `session.metadata`:
   ```typescript
   ...(resolved.executionMode && { "ao:executionMode": resolved.executionMode }),
   ```
   This is added to the session metadata object alongside `ao:modelTier` and `hookMetadata`.

7. **AC7 — `checkBlocked()` uses stored execution mode**: In `checkBlocked()`, instead of JSON-parsing a story context, read the lightweight `ao:executionMode` from session metadata:
   ```typescript
   const session = await this.sessionManager.get(agentId);
   const executionMode = session?.metadata?.["ao:executionMode"] as AgentMapping["executionMode"] | undefined;
   ```
   Pass this to `getTimeoutForAgent()` instead of the full story context.

8. **AC8 — Unit tests**: Comprehensive vitest tests covering:
   - `resolveSessionTimeout()` returns base timeout for standard/undefined execution mode
   - `resolveSessionTimeout()` returns 3x timeout for persistent mode
   - `resolveSessionTimeout()` returns 0.5x timeout for lightweight mode
   - `resolveSessionTimeout()` clamps to MIN_TIMEOUT and MAX_TIMEOUT
   - `resolveSessionTimeout()` uses custom multipliers from config
   - `EXECUTION_MODE_TIMEOUT_MULTIPLIERS` has all 3 execution modes
   - `getTimeoutForAgent()` with no execution mode returns agent-type default
   - `getTimeoutForAgent()` with persistent mode returns extended timeout
   - `checkBlocked()` reads execution mode from session metadata
   - Spawn flow stores `ao:executionMode` in session metadata
   - Backward compatibility: sessions without execution mode use existing timeouts

## Tasks / Subtasks

- [x] Task 1: Define types and constants (AC: #1, #3)
  - [x] 1.1 Create `packages/core/src/session-timeout.ts` with `EXECUTION_MODE_TIMEOUT_MULTIPLIERS` constant
  - [x] 1.2 Add `executionModeTimeouts` field to `BlockedAgentDetectorConfig` in `types.ts`
  - [x] 1.3 Export `EXECUTION_MODE_TIMEOUT_MULTIPLIERS` from `index.ts`

- [x] Task 2: Implement `resolveSessionTimeout()` (AC: #2)
  - [x] 2.1 Implement `resolveSessionTimeout()` in `session-timeout.ts`
  - [x] 2.2 Export function from `session-timeout.ts` and `index.ts`
  - [x] 2.3 Import MIN_TIMEOUT, MAX_TIMEOUT from `blocked-agent-detector.ts` (or duplicate as shared constants)

- [x] Task 3: Store execution mode in session metadata during spawn (AC: #6)
  - [x] 3.1 In session-manager.ts spawn flow, after agent mapping resolution, add `ao:executionMode` to session metadata

- [x] Task 4: Integrate into `BlockedAgentDetector` (AC: #4, #5, #7)
  - [x] 4.1 Add `executionMode` parameter to `getTimeoutForAgent()`
  - [x] 4.2 In `checkBlocked()`, look up session metadata for `ao:executionMode`
  - [x] 4.3 Pass execution mode to `getTimeoutForAgent()` for timeout calculation
  - [x] 4.4 Wrap lookup in try/catch — detection must never crash

- [x] Task 5: Unit tests (AC: #8)
  - [x] 5.1 Create `packages/core/src/__tests__/session-timeout.test.ts`
  - [x] 5.2 Test `resolveSessionTimeout()` for each execution mode
  - [x] 5.3 Test clamping behavior
  - [x] 5.4 Test custom multipliers from config
  - [x] 5.5 Test `getTimeoutForAgent()` integration
  - [x] 5.6 Test `checkBlocked()` reads execution mode from metadata
  - [x] 5.7 Test backward compatibility (no execution mode → existing behavior)

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

Persistent execution mode CLI flag (--persistent) is deferred to Story 61-5 (FR-Q3-1 through FR-Q3-3).
Dashboard display of effective timeout per session is deferred to Epic 60.

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
- [ ] `BlockedAgentDetector.checkBlocked()` — modified to pass execution mode
- [ ] `BlockedAgentDetector.getTimeoutForAgent()` — gains execution mode parameter
- [ ] `SessionManager.get()` — used to look up session metadata
- [ ] `StoryContext.agents?.executionMode` — from Story 59-6

**Feature Flags:**
- Execution mode timeout is only applied when `ao:executionMode` exists in session metadata. Sessions without this field use existing agent-type-based timeouts.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only existing types and modules.

## Dev Notes

### Architecture Context

This story bridges two subsystems:

1. **Agent mapping** (Story 59-6) — resolves `executionMode` per story type and stores it in session metadata
2. **Blocked agent detection** (Epic 19, Story 19.1) — periodically checks sessions for inactivity and marks them as blocked

Currently, the `BlockedAgentDetector` uses a flat timeout per agent type (claude-code: 10m, codex: 5m, aider: 15m). It has no awareness of the story's execution mode. This means a "persistent" session working on a complex implementation gets blocked after the same 10 minutes as a lightweight review session.

This story makes the detector **persistence-aware**: it reads the `executionMode` stored in session metadata during spawn and adjusts the effective timeout accordingly.

### How BlockedAgentDetector Works Today

```
checkBlocked()                    // Runs every 60s via setInterval
  → for each tracked agent:
    → getTimeoutForAgent(agentId) // Returns agent-type-based timeout
      → extractAgentType(agentId) // "claude-code" | "codex" | "aider" | "unknown"
      → return agentTypeTimeouts[type] ?? defaultTimeout
    → if inactive > timeout:
      → blockAgent(agentId)       // Marks blocked, publishes event
```

**What changes**: `getTimeoutForAgent()` gains an `executionMode` parameter. `checkBlocked()` looks up session metadata before calling it.

### Design Decision: Metadata vs. StoryContext

**Chosen approach: Store `ao:executionMode` in session metadata during spawn.**

Why not pass full `StoryContext` to the detector:
- `StoryContext` is a rich object with acceptance criteria, files, dependencies — overkill for timeout resolution
- The detector runs every 60s — JSON parsing a large context on every check is wasteful
- Session metadata is already available via `sessionManager.get()` — no new storage needed
- A single string field (`ao:executionMode`) is lightweight and sufficient

This matches the pattern established by `ao:modelTier` and `ao:model` metadata fields.

### Timeout Multipliers

| Execution Mode | Multiplier | Rationale |
|----------------|------------|-----------|
| `lightweight` | 0.5x | Exploration/review stories are quick — detect stalls faster |
| `standard` | 1.0x | Default — no change from agent-type timeout |
| `persistent` | 3.0x | Complex stories need more time — 30m claude-code becomes 90m |

Multipliers are configurable via `BlockedAgentDetectorConfig.executionModeTimeouts` for projects that need different tuning.

### Clamping

The effective timeout is clamped to [1m, 60m] regardless of multiplier:
- `lightweight` with 5m base → 2.5m, clamped to 2.5m (within range)
- `persistent` with 30m base → 90m, clamped to 60m (max)
- `persistent` with 10m base → 30m (within range)

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { readFile } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { AgentMapping, StoryType } from "./types.js"`

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
- **File fixtures**: Use `os.tmpdir()` for test files, clean up in afterEach

### Anti-Patterns to Avoid

- **DO NOT** modify the `BlockedAgentDetector` constructor signature — use the existing `config` field
- **DO NOT** make `checkBlocked()` async-heavy — session lookup must be fast or cached
- **DO NOT** validate execution mode against a known set — use the multiplier map directly
- **DO NOT** make timeout resolution blocking — wrap in try/catch, fall back to agent-type default
- **DO NOT** add external dependencies — this is pure TypeScript logic

### Limitations (Deferred Items)

1. **CLI `--persistent` flag**
   - Status: Deferred — Story 61-5 (FR-Q3-1 through FR-Q3-3)
   - Requires: CLI flag to force persistent execution mode regardless of story type
   - Current: Execution mode is only set via agent mapping config cascade

2. **Dashboard display of effective timeout**
   - Status: Deferred — Epic 60
   - Requires: API route and panel component to show current timeout per session
   - Current: Effective timeout is internal to blocked agent detection

3. **Dynamic timeout adjustment during session**
   - Status: Deferred — future enhancement
   - Requires: Ability to change execution mode mid-session based on work progress
   - Current: Execution mode is set once during spawn and never changes

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 59, Story 59-7 definition, FR-S2-4]
- [Source: `packages/core/src/types.ts:1875-1893` — BlockedAgentDetectorConfig, BlockedAgentStatus]
- [Source: `packages/core/src/blocked-agent-detector.ts` — Full detector implementation]
- [Source: `packages/core/src/agent-mapping.ts:20-41` — DEFAULT_AGENT_MAPPINGS with executionMode values]
- [Source: `packages/core/src/session-manager.ts:776-791` — Agent mapping resolution in spawn (insertion point for metadata)]
- [Source: `packages/core/src/session-manager.ts:853-873` — Session metadata construction (add ao:executionMode)]
- [Source: `_bmad-output/implementation-artifacts/59-6-story-agent-mapping-configuration.md` — Previous story, deferred item for 59-7]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, shell command security]

### Previous Story Intelligence (59-6)

**Key learnings from 59-6 that impact this story:**

1. **`executionMode` is already stored in agent mapping**: The `AgentMapping` interface has `executionMode?: "standard" | "persistent" | "lightweight"`. Story 59-6 resolves this and sets it on `storyContext.agents`. This story reads it from session metadata.

2. **Session metadata pattern established**: 59-6's spawn flow already stores `ao:modelTier`, `ao:model`, and `hookMetadata` in session.metadata. This story adds `ao:executionMode` using the same pattern.

3. **Dynamic import pattern**: 59-6 uses `await import("./agent-mapping.js")` for spawn flow imports. This story can use `await import("./session-timeout.js")` if needed in the detector, but since the detector is initialized at startup, static imports are preferred.

4. **Best-effort enrichment pattern**: Like agent mapping, timeout resolution must wrap in try/catch so failures never crash the detection loop.

5. **`"persistent"` is never a default value**: No built-in `DEFAULT_AGENT_MAPPINGS` entry uses `executionMode: "persistent"`. It only appears when configured via project config or story-level override. This means the 3x multiplier is opt-in by default.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- ESLint hook required all imports to be used before committing; resolved by writing full file in one shot
- Pre-existing standup-generator.test.ts date failure (2026-04-12 vs 2026-04-13) — not related to this story

### Completion Notes List

1. `session-timeout.ts` created with `EXECUTION_MODE_TIMEOUT_MULTIPLIERS` (standard=1.0, persistent=3.0, lightweight=0.5)
2. `resolveSessionTimeout()` computes effective timeout with multiplier, clamps to [1m, 60m]
3. `executionModeTimeouts` field added to `BlockedAgentDetectorConfig` in types.ts for custom multiplier overrides
4. `BlockedAgentDetector.getTimeoutForAgent()` gains optional `executionMode` parameter
5. `checkBlocked()` reads `ao:executionMode` from session metadata, wrapped in try/catch
6. `session-manager.ts` spawn flow stores `ao:executionMode` in session metadata alongside `ao:modelTier` and `ao:model`
7. All 25 tests pass — multipliers, clamping, custom config, integration, backward compatibility
8. Full suite: 2484 tests pass, 0 regressions from this story

### Code Review Fixes (post-review)

9. **MEDIUM-1**: Cached execution mode in `BlockedAgentStatus.executionMode` — refreshed every 5 check cycles instead of N+1 `sessionManager.get()` per cycle. Added `checkCycle` counter and `EXECUTION_MODE_REFRESH_INTERVAL` constant.
10. **MEDIUM-2**: Fixed misleading test comment ("clamped from 1m" → "exactly MIN_TIMEOUT" — no clamping occurs at boundary).
11. **LOW-1**: Deduplicated `MIN_TIMEOUT`/`MAX_TIMEOUT` — now exported from `session-timeout.ts`, imported in `blocked-agent-detector.ts`. Also exported from `index.ts`.
12. **LOW-2**: Replaced `as never` type-unsafe mock casts with `as unknown as BlockedAgentDetectorDeps` for explicit typing in tests.
13. Added `executionMode` field to `BlockedAgentStatus` interface in `types.ts` for caching.

### File List

| File | Change |
|------|--------|
| `packages/core/src/session-timeout.ts` | NEW — EXECUTION_MODE_TIMEOUT_MULTIPLIERS, resolveSessionTimeout, exported MIN_TIMEOUT/MAX_TIMEOUT |
| `packages/core/src/blocked-agent-detector.ts` | MODIFY — execution-mode-aware getTimeoutForAgent, cached execution mode in checkBlocked, imported shared constants, executionModeTimeouts field |
| `packages/core/src/types.ts` | MODIFY — Add executionModeTimeouts to BlockedAgentDetectorConfig, executionMode to BlockedAgentStatus |
| `packages/core/src/index.ts` | MODIFY — Export session-timeout functions, constants, MIN_TIMEOUT, MAX_TIMEOUT |
| `packages/core/src/session-manager.ts` | MODIFY — Store ao:executionMode in session metadata during spawn |
| `packages/core/src/__tests__/session-timeout.test.ts` | NEW — 25 tests for session timeout functions, typed mocks |
| `_bmad-output/implementation-artifacts/59-7-persistence-aware-session-timeout.md` | MODIFY — This story file, status updated to review |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-7 status updated to in-progress |
