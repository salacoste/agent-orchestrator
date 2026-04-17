# Story 59.2: Compaction Survival Hooks

Status: done

## Story

As a developer working on an agent session that experiences context compaction,
I want the orchestrator to automatically save my working state before compaction and reload it afterward,
so that I don't lose critical task progress, blocking issues, or key decisions when the LLM context window compacts.

## Acceptance Criteria

1. **AC1 — PreCompactHook type**: A new type `PreCompactHook` is defined in `types.ts` with a single method signature: `(worktreePath: string, sessionMetadata: Record<string, string>) => Promise<void>`. A `HookRegistry` interface is defined to hold named hooks: `{ preCompact: Map<string, PreCompactHook>; postCompact: Map<string, PostCompactHook> }`.
2. **AC2 — PostCompactHook type**: A new type `PostCompactHook` is defined in `types.ts` with signature: `(worktreePath: string) => Promise<string>`. Returns the context string to inject back into the session after compaction.
3. **AC3 — createHookRegistry() factory**: A new exported function `createHookRegistry(): HookRegistry` in a new module `packages/core/src/hooks.ts` returns an empty registry with `register()`, `runPreCompact()`, and `runPostCompact()` methods.
4. **AC4 — Notepad pre-compact hook**: A built-in hook `notepadPreCompact` is implemented that calls `writeNotepadSection(worktreePath, "working", ...)` with a summary of current task state extracted from session metadata. Registered by default in the hook registry.
5. **AC5 — Notepad post-compact hook**: A built-in hook `notepadPostCompact` is implemented that calls `readNotepad(worktreePath)` and returns the combined notepad content as a string for re-injection into the session context. Registered by default.
6. **AC6 — Project memory pre-compact hook**: A built-in hook `projectMemoryPreCompact` reads `.omc/project-memory.json`, merges any new learnings from session metadata, and writes it back. Registered by default.
7. **AC7 — Integration with session-manager spawn flow**: The session-manager's `spawn()` method is updated to initialize the hook registry and store it on the session metadata (or a side-channel). The `createSessionManager` function accepts an optional `HookRegistry` in its deps.
8. **AC8 — Hook execution in lifecycle manager**: The session-manager exposes `runPreCompactHooks()` and `runPostCompactHooks()` methods on the `SessionManager` interface. The lifecycle manager (or any caller) can invoke these around compact events. Hook failures are caught, logged, and do not block the compact cycle. **Note**: Actual compact-event detection in the lifecycle manager polling loop is deferred — the methods exist as the callable API but no trigger is wired yet.
9. **AC9 — Unit tests**: Comprehensive vitest tests covering:
   - `createHookRegistry()` returns empty registry
   - `register()` adds hooks to correct phase
   - `runPreCompact()` calls all registered hooks in order
   - `runPostCompact()` returns concatenated context from all hooks
   - `notepadPreCompact` writes working memory section
   - `notepadPostCompact` reads and returns notepad content
   - `projectMemoryPreCompact` merges learnings into project-memory.json
   - Hook failures are caught and logged without blocking other hooks
   - Registry is independent per session (no cross-session contamination)

## Tasks / Subtasks

- [x] Task 1: Define hook types (AC: #1, #2)
  - [x] 1.1 Add `PreCompactHook` type to `packages/core/src/types.ts`
  - [x] 1.2 Add `PostCompactHook` type to `packages/core/src/types.ts`
  - [x] 1.3 Add `HookRegistry` interface to `packages/core/src/types.ts`
  - [x] 1.4 Export all three from `packages/core/src/index.ts`

- [x] Task 2: Create hooks module (AC: #3)
  - [x] 2.1 Create `packages/core/src/hooks.ts`
  - [x] 2.2 Implement `createHookRegistry()` — returns registry with `register()`, `runPreCompact()`, `runPostCompact()` methods
  - [x] 2.3 `register(phase, name, hook)` — adds hook to the correct phase map
  - [x] 2.4 `runPreCompact(worktreePath, sessionMetadata)` — runs all pre-compact hooks in registration order, catches failures
  - [x] 2.5 `runPostCompact(worktreePath)` — runs all post-compact hooks, returns concatenated context strings
  - [x] 2.6 Export `createHookRegistry` and built-in hooks from `hooks.ts`
  - [x] 2.7 Add exports to `packages/core/src/index.ts`

- [x] Task 3: Implement built-in hooks (AC: #4, #5, #6)
  - [x] 3.1 Implement `notepadPreCompact` — extracts task state from metadata, writes to Working Memory via `writeNotepadSection`
  - [x] 3.2 Implement `notepadPostCompact` — reads notepad via `readNotepad`, returns formatted context string
  - [x] 3.3 Implement `projectMemoryPreCompact` — reads/merges/writes `.omc/project-memory.json`
  - [x] 3.4 Create `registerDefaultHooks(registry)` convenience function that registers all three built-in hooks

- [x] Task 4: Integration with session-manager (AC: #7)
  - [x] 4.1 Add optional `HookRegistry` to `SessionManagerDeps` interface
  - [x] 4.2 In `spawn()`, if no registry provided, create one and register default hooks
  - [x] 4.3 Store registry reference for lifecycle manager access (e.g., on session metadata with key `hooks:registry`)
  - [x] 4.4 Wrap in try/catch — hook registry creation must never block session spawn

- [x] Task 5: Integration with session-manager lifecycle (AC: #8)
  - [x] 5.1 Add `runPreCompactHooks`/`runPostCompactHooks` methods to SessionManager interface
  - [x] 5.2 Implement methods in session-manager.ts — look up hook registry by session ID, call registry.runPreCompact/runPostCompact
  - [x] 5.3 Inject post-compact context into session prompt or metadata
  - [x] 5.4 Wrap each hook invocation in try/catch — log errors but continue
  - [x] 5.5 Store hook registries in Map<SessionId, HookRegistry> for lifecycle access
  - [x] 5.6 Wrap spawn/kill to manage registry lifecycle

- [x] Task 6: Unit tests (AC: #9)
  - [x] 6.1 Create `packages/core/src/__tests__/hooks.test.ts`
  - [x] 6.2 Test `createHookRegistry()` returns empty registry
  - [x] 6.3 Test `register()` adds hooks to correct phase
  - [x] 6.4 Test `runPreCompact()` calls all hooks in order
  - [x] 6.5 Test `runPostCompact()` returns concatenated context
  - [x] 6.6 Test `notepadPreCompact` writes Working Memory section
  - [x] 6.7 Test `notepadPostCompact` reads and returns notepad content
  - [x] 6.8 Test `projectMemoryPreCompact` merges learnings into project-memory.json
  - [x] 6.9 Test hook failures are caught without blocking other hooks
  - [x] 6.10 Test per-session registry isolation

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

SSE notification for notepad changes is deferred to Epic 60, Story 60-1.
Persistent execution mode that leverages hook state is deferred to Epic 61, Story 61-5.
Configurable hook profiles per story type are deferred to Story 59-5.

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
- [x] `writeNotepadSection(worktreePath, section, content)` — from `notepad.ts` (Story 59-1)
- [x] `readNotepad(worktreePath)` — from `notepad.ts` (Story 59-1)
- [x] `readFile` / `writeFile` from `node:fs/promises` — for project-memory.json I/O
- [x] `SessionEnhancementProvider.enhance()` — existing interface, may be extended

**Feature Flags:**
- Hook execution is gated by provider !== "raw". When raw provider is used, no hooks are registered (RawProvider has no compact lifecycle).

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only `node:fs/promises`, `node:path`, and existing notepad/types modules.

## Dev Notes

### Architecture Context

This story builds the hook infrastructure that enables compaction survival. It's the second story in Epic 59, building on the notepad system from 59-1.

**What Story 59-1 built (foundation):**
- `NotepadSection`, `NotepadContent`, `SprintContext` types
- `createNotepad()`, `readNotepad()`, `writeNotepadSection()` functions in `notepad.ts`
- Atomic writes (temp-file-then-rename) for notepad section updates
- OMC provider refactor to delegate to `createNotepad()`
- Story context enrichment in session-manager

**What 59-2 adds (THIS STORY):**
- `PreCompactHook` and `PostCompactHook` type definitions
- `HookRegistry` interface and `createHookRegistry()` factory
- Three built-in hooks: `notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact`
- Integration with session-manager spawn flow
- Integration with lifecycle manager compact events

### Hook Execution Flow

```
Session Spawn (session-manager.ts)
  → Create HookRegistry
  → Register default hooks (notepad, project-memory)
  → Store registry reference
  → Agent runs...
  → [Compaction event detected]
      → lifecycle-manager calls registry.runPreCompact()
          → notepadPreCompact: writes Working Memory to notepad
          → projectMemoryPreCompact: saves learnings to project-memory.json
      → Compaction occurs — context window resets
      → lifecycle-manager calls registry.runPostCompact()
          → notepadPostCompact: reads notepad → returns context string
      → Context string injected into session prompt
  → Agent continues with restored context
```

### Key Design Decisions

1. **HookRegistry is per-session**: Each spawned session gets its own registry instance. This prevents cross-session contamination and allows story-type-specific hook profiles (Story 59-5).

2. **Hooks are named and ordered**: Hooks are stored in a `Map<string, Hook>` to allow removal/override by name. Execution order matches insertion order (Map guarantees this in ES6+).

3. **Hook failures are non-fatal**: Each hook runs in a try/catch. If a hook fails, the error is logged and the next hook continues. Compaction must never be blocked by a hook failure.

4. **Post-compact returns string, not structured data**: `PostCompactHook` returns a plain string because the output needs to be injected into the LLM prompt — it's natural language context, not structured data.

5. **projectMemoryPreCompact reads/writes JSON**: The `.omc/project-memory.json` file was created by OMCProvider.install() (Story 58-3) as an empty `{}`. This hook populates it with actual learnings.

6. **Built-in hooks are registered via convenience function**: `registerDefaultHooks(registry)` registers all three built-in hooks. This keeps the session-manager integration clean — one function call.

7. **Registry stored on session metadata**: The hook registry is stored on the session's metadata object with a key like `hooks:registry`. This gives the lifecycle manager access without introducing a new parameter to the compact event handler.

### Notepad Working Memory Format (pre-compact hook)

The `notepadPreCompact` hook writes a structured summary to the Working Memory section:

```markdown
Current Task: [extracted from metadata or "Unknown"]
Blocking Issues:
- [issue list from metadata]
Key Decisions:
- [decisions from metadata]
Files Modified:
- [file list from metadata]
Last Action: [most recent action]
```

This matches the notepad format established in 59-1 and is designed to be compact but information-dense.

### Post-Compact Context Injection

The `notepadPostCompact` hook returns a formatted string like:

```
[COMPACTION RECOVERY — Context Restored from Notepad]
## Priority
[notepad priority section content]

## Working Memory
[notepad working memory section content]

## Manual
[notepad manual section content]
```

This is designed to be injected as a system message or prompt prefix after compaction.

### File Change Impact

| File | Change | Why |
|------|--------|-----|
| `packages/core/src/hooks.ts` | NEW | HookRegistry factory, built-in hooks, registerDefaultHooks |
| `packages/core/src/types.ts` | MODIFY | Add PreCompactHook, PostCompactHook, HookRegistry types |
| `packages/core/src/index.ts` | MODIFY | Export hooks module and new types |
| `packages/core/src/session-manager.ts` | MODIFY | Initialize hook registry in spawn(), store on session, expose runPreCompactHooks/runPostCompactHooks, hook registry lifecycle management |
| `packages/core/src/__tests__/hooks.test.ts` | NEW | Unit tests for hook registry and built-in hooks |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { readFile } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { NotepadContent, HookRegistry } from "./types.js"`

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

- **DO NOT** implement SSE notifications for hook events — that's Epic 60
- **DO NOT** implement hook profiles per story type — that's Story 59-5
- **DO NOT** implement persistent execution mode — that's Epic 61, Story 61-5
- **DO NOT** make hook execution blocking — compaction must always proceed even if hooks fail
- **DO NOT** store the hook registry in a global singleton — it must be per-session
- **DO NOT** add a database dependency — flat file I/O only (notepad + project-memory.json)

### Limitations (Deferred Items)

1. **Hook profiles per story type**
   - Status: Deferred — Story 59-5
   - Requires: Story-type detection and configurable hook sets
   - Current: All sessions get the same default hooks

2. **SSE notification on notepad changes**
   - Status: Deferred — Epic 60, Story 60-1
   - Requires: SSE endpoint and file watcher
   - Current: Notepad changes are silent

3. **Persistent execution mode leveraging hook state**
   - Status: Deferred — Epic 61, Story 61-5
   - Requires: Verification gates and persistent session lifecycle
   - Current: Hooks run on compact events only

4. **Compact-event detection in lifecycle manager polling loop**
   - Status: Deferred — requires agent plugin instrumentation
   - Requires: Agent plugin (e.g., claude-code) to emit compact events, or CLI command to trigger hooks
   - Current: `runPreCompactHooks`/`runPostCompactHooks` methods exist on SessionManager but no automatic trigger is wired. Manual invocation via CLI or programmatic call is needed.

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 59, Story 59-2 definition, FR-S1-2, FR-S1-3]
- [Source: `packages/core/src/notepad.ts` — createNotepad, readNotepad, writeNotepadSection]
- [Source: `packages/core/src/types.ts:1262-1299` — SessionEnhancementProvider interface]
- [Source: `packages/core/src/types.ts:1206-1217` — StoryContext interface]
- [Source: `packages/core/src/types.ts:1219-1230` — NotepadSection, NotepadContent, SprintContext]
- [Source: `packages/core/src/session-manager.ts:504-560` — Provider install flow in spawn()]
- [Source: `packages/core/src/session-manager.ts:605-673` — Provider configure flow in spawn()]
- [Source: `packages/plugins/provider-omc/src/index.ts` — OMCProvider, project-memory.json creation]
- [Source: `packages/core/src/lifecycle-manager.ts` — State machine and reaction engine]
- [Source: `_bmad-output/implementation-artifacts/59-1-notepad-creation-story-context.md` — Previous story learnings]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, shell command security]

### Previous Story Intelligence (59-1)

**Key learnings from 59-1 that impact this story:**

1. **Atomic writes are critical**: The notepad module uses temp-file-then-rename for all writes. Any new file writes (project-memory.json) should follow the same pattern.

2. **Line-anchored regex parsing**: `parseSections()` uses `(?:^|\n)` anchored regex. If parsing hook output, use the same pattern.

3. **Best-effort enrichment pattern**: Story context enrichment in session-manager wraps in try/catch so failures never block spawn. Hook registration should follow the same pattern.

4. **`.omc/` directory already exists**: Story 59-1 ensured `.omc/` is created in both `createNotepad()` and `writeNotepadSection()`. The project-memory.json file is in this same directory — no need to create it.

5. **OMCProvider.install() creates project-memory.json**: It's initialized as `{}`. The project-memory hook should merge, not overwrite.

6. **ESLint caught unused imports**: The 59-1 code review fixed an unused `mkdirSync` import. Be careful to only import what's used.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List

| File | Change |
|------|--------|
| `packages/core/src/hooks.ts` | NEW — createHookRegistry, built-in hooks, registerDefaultHooks |
| `packages/core/src/types.ts` | MODIFY — Added PreCompactHook, PostCompactHook, HookRegistry |
| `packages/core/src/index.ts` | MODIFY — Export hooks module and types |
| `packages/core/src/session-manager.ts` | MODIFY — Initialize hook registry in spawn(), expose runPreCompactHooks/runPostCompactHooks on SessionManager |
| `packages/core/src/__tests__/hooks.test.ts` | NEW — Unit tests for hook registry and built-in hooks |
| `packages/core/src/__tests__/blocked-agent-detector.test.ts` | MODIFY — Add runPreCompactHooks/runPostCompactHooks to SessionManager mock |
| `packages/core/src/__tests__/completion-wiring.test.ts` | MODIFY — Add runPreCompactHooks/runPostCompactHooks to SessionManager mock |
| `packages/core/src/__tests__/lifecycle-manager.test.ts` | MODIFY — Add runPreCompactHooks/runPostCompactHooks to SessionManager mock |
| `_bmad-output/implementation-artifacts/59-2-compaction-survival-hooks.md` | NEW — This story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-2 status updated |
