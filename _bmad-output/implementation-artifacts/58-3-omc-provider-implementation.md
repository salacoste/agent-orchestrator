# Story 58.3: OMC Provider Implementation

Status: review

## Story

As a system architect,
I want an `OMCProvider` implementing `SessionEnhancementProvider` that sets up oh-my-claudecode (OMC) directory structures, configuration, and agent catalog injection in spawned session worktrees,
so that every agent session transparently gains access to OMC's sub-agent delegation, model routing, and compaction survival features when the "omc" provider is configured.

## Acceptance Criteria

1. **AC1 — OMCProvider plugin package**: A new plugin package `@composio/ao-plugin-provider-omc` at `packages/plugins/provider-omc/` exports a `PluginModule<SessionEnhancementProvider>` with `manifest.name = "omc"` and `manifest.slot = "provider"`. The package follows the exact same structure as `provider-raw` (package.json, tsconfig.json, src/index.ts).
2. **AC2 — install() creates .omc/ directory structure**: `install(worktreePath, config)` creates the following directories and files inside `worktreePath`:
   - `.omc/state/` (empty directory)
   - `.omc/plans/` (empty directory)
   - `.omc/logs/` (empty directory)
   - `.omc/notepad.md` with three empty sections: `## Priority`, `## Working Memory`, `## Manual`
   - `.omc/project-memory.json` with empty object `{}`
   Installation is idempotent — calling install() on an already-installed worktree succeeds without error.
3. **AC3 — configure() generates omc.jsonc**: `configure(worktreePath, context)` generates `.claude/omc.jsonc` in the worktree with:
   - Agent model mappings derived from the provider config (passed via `config` parameter in `create(config)`)
   - Default routing config with the tier mapping from `sessionEnhancement.modelTiers` (if provided in config)
   - Feature flags (parallelExecution, autoContextInjection) enabled by default
   The `.claude/` directory is created if it doesn't exist. Pre-populates `.omc/notepad.md` Priority section with `StoryContext` data (storyId, acceptanceCriteria, relevantFiles) when available.
4. **AC4 — enhance() injects agent catalog**: `enhance(session)` adds OMC-specific metadata to the session:
   - `metadata["omc:agents"]` — JSON-serialized list of enabled OMC agent names
   - `metadata["omc:executionMode"]` — default execution mode string (e.g., `"standard"`)
   - `metadata["omc:configured"]` — `"true"` to mark the session as OMC-enhanced
   Returns the modified session. Does NOT throw — errors are caught and the original session returned unchanged.
5. **AC5 — teardown() cleans up**: `teardown(worktreePath)` removes the `.omc/` directory tree from the worktree. Uses recursive delete. Wraps in try/catch — missing directory is not an error.
6. **AC6 — healthCheck() verifies installation**: `healthCheck()` verifies the OMC provider can operate by checking that the required node modules are available (no filesystem check — the provider doesn't install OMC itself, it prepares worktrees). Returns `{ healthy: true, lastCheck: new Date() }` always — actual OMC health is story 58-6's concern.
7. **AC7 — BUILTIN_PLUGINS registration**: `{ slot: "provider", name: "omc", pkg: "@composio/ao-plugin-provider-omc" }` is added to the `BUILTIN_PLUGINS` array in `plugin-registry.ts`.
8. **AC8 — Unit tests**: Comprehensive vitest tests covering: install creates all directories/files, install is idempotent, configure generates valid omc.jsonc, configure populates notepad, enhance injects metadata without throwing, teardown removes .omc/, healthCheck returns healthy, plugin registration.

## Tasks / Subtasks

- [x] Task 1: Create provider-omc plugin package (AC: #1)
  - [x] 1.1 Create `packages/plugins/provider-omc/package.json` with name `@composio/ao-plugin-provider-omc`, dependency on `@composio/ao-core: "workspace:*"`, ESM module type, standard scripts (build, typecheck, test, clean)
  - [x] 1.2 Create `packages/plugins/provider-omc/tsconfig.json` following existing plugin tsconfig pattern (see `provider-raw/tsconfig.json`)
  - [x] 1.3 Create `packages/plugins/provider-omc/src/index.ts` with manifest `{ name: "omc", slot: "provider", description: "Provider plugin: oh-my-claudecode session enhancement", version: "0.1.0" }` and skeleton `create()` function implementing `SessionEnhancementProvider`
  - [x] 1.4 Export `manifest`, `create`, and `default` with `satisfies PluginModule<SessionEnhancementProvider>`

- [x] Task 2: Implement install() (AC: #2)
  - [x] 2.1 Import `mkdir`, `writeFile` from `node:fs/promises` and `join` from `node:path`
  - [x] 2.2 Create `.omc/state/`, `.omc/plans/`, `.omc/logs/` directories using `mkdir(..., { recursive: true })` for idempotency
  - [x] 2.3 Create `.omc/notepad.md` with three-section template: `## Priority\n\n## Working Memory\n\n## Manual\n`
  - [x] 2.4 Create `.omc/project-memory.json` with `{}` content
  - [x] 2.5 Wrap in try/catch — all file operations should succeed silently if directories already exist

- [x] Task 3: Implement configure() (AC: #3)
  - [x] 3.1 Generate omc.jsonc config object from `this.config` (received in create()):
    - `agents` section: map of agent name → `{ model }` from config or defaults
    - `routing` section: `tierModels` from config's `modelTiers` if present, otherwise `DEFAULT_MODEL_TIERS` values
    - `features` section: `{ parallelExecution: true, autoContextInjection: true, lspTools: true, astTools: true }`
  - [x] 3.2 Create `.claude/` directory if needed, write `.claude/omc.jsonc` with JSON.stringify + 2-space indent
  - [x] 3.3 Pre-populate `.omc/notepad.md` Priority section: append story context (storyId, acceptance criteria, relevant files) from `StoryContext` parameter
  - [x] 3.4 Handle missing/empty StoryContext gracefully (write only what's available)

- [x] Task 4: Implement enhance() (AC: #4)
  - [x] 4.1 Add `metadata["omc:agents"]` = JSON.stringify of enabled agent names from config (or default list: `["explore", "planner", "architect", "executor", "verifier"]`)
  - [x] 4.2 Add `metadata["omc:executionMode"]` = `"standard"` (configurable via provider config in future stories)
  - [x] 4.3 Add `metadata["omc:configured"]` = `"true"`
  - [x] 4.4 Wrap entire method in try/catch — on error, return original session unchanged

- [x] Task 5: Implement teardown() and healthCheck() (AC: #5, #6)
  - [x] 5.1 teardown(): use `rm(worktreePath + "/.omc", { recursive: true, force: true })` from `node:fs/promises`
  - [x] 5.2 Wrap teardown in try/catch — missing directory is not an error, just log and continue
  - [x] 5.3 healthCheck(): return `{ healthy: true, lastCheck: new Date() }` — always healthy (actual health monitoring is 58-6)

- [x] Task 6: Register in BUILTIN_PLUGINS (AC: #7)
  - [x] 6.1 Add `{ slot: "provider", name: "omc", pkg: "@composio/ao-plugin-provider-omc" }` to `BUILTIN_PLUGINS` array in `packages/core/src/plugin-registry.ts`

- [x] Task 7: Unit tests (AC: #8)
  - [x] 7.1 Create `packages/plugins/provider-omc/src/__tests__/index.test.ts`
  - [x] 7.2 Test install(): creates all directories and files, verify with fs reads
  - [x] 7.3 Test install() idempotency: call install() twice on same path, no errors
  - [x] 7.4 Test configure(): generates omc.jsonc with expected structure, populates notepad
  - [x] 7.5 Test enhance(): session has omc metadata keys, values are valid JSON strings
  - [x] 7.6 Test enhance() error resilience: returns original session on any error
  - [x] 7.7 Test teardown(): .omc/ directory removed after call
  - [x] 7.8 Test healthCheck(): returns `{ healthy: true }` with Date instance
  - [x] 7.9 Use `os.tmpdir()` + random suffix for test isolation, clean up in afterEach

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

Model routing logic itself (auto-escalation, failure tracking) is story 58-4.
Full CLAUDE.md merge strategy is story 59-4.
Compaction survival hooks are story 59-2.
Auto-install of OMC npm package is story 59-3.
Circuit breaker / provider health monitoring is story 58-6.

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
- [x] `SessionEnhancementProvider.install(worktreePath, config)` — implemented with .omc/ directory creation
- [x] `SessionEnhancementProvider.configure(worktreePath, context)` — implemented with omc.jsonc generation
- [x] `SessionEnhancementProvider.enhance(session)` — implemented with metadata injection
- [x] `SessionEnhancementProvider.teardown(worktreePath)` — implemented with .omc/ cleanup
- [x] `SessionEnhancementProvider.healthCheck()` — implemented (always healthy)
- [x] `PluginRegistry.register(module, config)` — existing, used during loadBuiltins
- [x] `PluginRegistry.list("provider")` — existing, used by CLI providers command

**Feature Flags:**
- None needed — OMC provider is opt-in via `sessionEnhancement.provider: "omc"` in config.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary (can existing code be used?) — No new external dependencies. Uses only `node:fs/promises`, `node:path`, and `@composio/ao-core`.
- [x] Run `pnpm audit` to check for known vulnerabilities — N/A (no new external deps)
- [x] Verify license compatibility — N/A
- [x] Review dependency health — N/A
- [x] Document dependency in sprint-status.yaml if applicable — N/A

## Dev Notes

### Architecture Context

This story creates the first real `SessionEnhancementProvider` implementation. Stories 58-1 and 58-2 built the foundation:

**What 58-1 implemented:**
- `SessionEnhancementProvider` interface in types.ts with 5 lifecycle methods
- `"provider"` as 8th plugin slot in `PluginSlot` union
- `RawProvider` no-op implementation at `packages/plugins/provider-raw/`
- Provider integration in session-manager spawn/kill flow with graceful degradation
- Health check + fallback to RawProvider on failure

**What 58-2 implemented:**
- `SessionEnhancementConfig` with `modelTiers` field
- `extractPluginConfig()` passthrough in plugin-registry.ts
- `resolveModelTiers()` cascade helper
- Startup provider validation (non-blocking warnings)
- CLI `ao providers` command

**What 58-3 adds (THIS STORY):**
- `OMCProvider` — a real provider that prepares worktrees for oh-my-claudecode
- `.omc/` directory structure creation and teardown
- Configuration generation (omc.jsonc)
- Session metadata injection via `enhance()`

### OMC Architecture Summary

OMC (oh-my-claudecode) is a Claude Code plugin that enhances sessions with:
- **19 sub-agents** (explore, planner, architect, executor, verifier, etc.)
- **Model routing** (LOW/MEDIUM/HIGH tiers mapped to haiku/sonnet/opus)
- **Compaction survival** via notepad.md and project-memory.json
- **Hooks** for lifecycle events (SessionStart, PreCompact, Stop, etc.)

The OMC provider does NOT install OMC itself (that's story 59-3). It prepares the worktree with the directory structure and configuration that OMC expects.

### Key File: Session.metadata

```typescript
// Session.metadata is Record<string, string>
// OMC provider will store structured data as JSON-serialized strings:
metadata["omc:agents"] = JSON.stringify(["explore", "executor", "verifier"])
metadata["omc:executionMode"] = "standard"
metadata["omc:configured"] = "true"
```

### .omc/ Directory Structure

```
worktree/
  .omc/
    state/                  # Per-mode JSON state files
    plans/                  # Execution plan documents
    logs/                   # Execution logs
    notepad.md              # Compaction-resistant memo (3 sections)
    project-memory.json     # Cross-session knowledge (empty {})
```

### omc.jsonc Configuration

Generated by `configure()` from provider config. Structure:

```jsonc
{
  "agents": {
    "omc": { "model": "claude-opus-4-6" },
    "explore": { "model": "claude-haiku-4-5" },
    "executor": { "model": "claude-sonnet-4-6" },
    "verifier": { "model": "claude-sonnet-4-6" }
    // ... more agents from config or defaults
  },
  "routing": {
    "enabled": true,
    "defaultTier": "MEDIUM",
    "tierModels": {
      "LOW": "claude-haiku-4-5",
      "MEDIUM": "claude-sonnet-4-6",
      "HIGH": "claude-opus-4-6"
    }
  },
  "features": {
    "parallelExecution": true,
    "autoContextInjection": true
  }
}
```

### Default Agent List

When no agent config is provided, OMCProvider uses these defaults:

```typescript
const DEFAULT_OMC_AGENTS = [
  "omc", "explore", "analyst", "planner", "architect",
  "debugger", "executor", "verifier", "tracer",
];
```

### Where extractPluginConfig provides config

```typescript
// plugin-registry.ts: extractPluginConfig()
// When sessionEnhancement.provider === "omc" and sessionEnhancement.config exists:
// config.sessionEnhancement.config is passed to create(config)
//
// Example YAML:
// sessionEnhancement:
//   provider: omc
//   config:
//     agents:
//       executor:
//         model: claude-sonnet-4-6
//     routing:
//       defaultTier: MEDIUM
```

### Plugin Package Structure (follow exactly)

```
packages/plugins/provider-omc/
  package.json          # @composio/ao-plugin-provider-omc
  tsconfig.json
  src/
    index.ts            # manifest + create + default export
    __tests__/
      index.test.ts     # Unit tests
```

### Critical Files to Read Before Implementation

| File | Why |
|------|-----|
| `packages/plugins/provider-raw/src/index.ts` | Reference implementation — follow this exact pattern |
| `packages/plugins/provider-raw/package.json` | Package structure template |
| `packages/plugins/provider-raw/tsconfig.json` | TypeScript config template |
| `packages/core/src/types.ts:1204-1241` | `SessionEnhancementProvider` interface — must implement all 5 methods |
| `packages/core/src/types.ts:148-190` | `Session` interface — `metadata: Record<string, string>` for enhance() |
| `packages/core/src/types.ts:1165-1192` | `ProviderConfig`, `StoryContext`, `ProviderHealth` types |
| `packages/core/src/types.ts:997-1017` | `ModelTier`, `ModelTierMapping`, `DEFAULT_MODEL_TIERS`, `SessionEnhancementConfig` |
| `packages/core/src/plugin-registry.ts:38-66` | `BUILTIN_PLUGINS` — add omc entry |
| `packages/core/src/plugin-registry.ts:73-86` | `extractPluginConfig()` — understand how config reaches create() |
| `packages/core/src/session-manager.ts:502-601` | Spawn flow — understand when install/configure/enhance are called |
| `_tmp/omc-report/01-architecture.md` | OMC directory structure and config format reference |
| `_tmp/omc-report/02-agents.md` | OMC agent catalog reference |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { mkdir, writeFile, rm } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { SessionEnhancementProvider } from "@composio/ao-core"`

### TypeScript Conventions (MUST follow)

- ESM modules — `"type": "module"` in package.json
- Strict mode — `"strict": true` in tsconfig
- No `any` — use `unknown` + type guards
- No non-null assertions (`!`) — use guards
- Semicolons, double quotes, 2-space indent (enforced by Prettier)

### Testing Standards

- **Framework**: vitest
- **Location**: `src/__tests__/*.test.ts` co-located with source
- **Pattern**: Use `os.tmpdir()` + random suffix for filesystem test isolation
- **Cleanup**: `afterEach` removes temp directories
- **Coverage**: All public methods, error paths, idempotency, fallback behavior
- **Assertion style**: `expect(x).toBe(y)` — no `expect(true).toBe(true)`
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in package

### Key Design Decisions

1. **Provider prepares, doesn't install OMC**: The OMC provider creates the directory structure and config files that OMC expects. The actual OMC tool installation (npm package / Claude plugin) is story 59-3.

2. **Config from sessionEnhancement.config**: The omc.jsonc content is derived from the `config` parameter passed to `create(config)`, which comes from `sessionEnhancement.config` in YAML via `extractPluginConfig()`.

3. **Metadata uses namespaced keys**: All OMC metadata uses `omc:` prefix (e.g., `omc:agents`, `omc:configured`) to avoid collision with other metadata.

4. **enhance() is error-resilient**: If anything goes wrong during enhance(), the original session is returned unchanged. The provider MUST NOT throw from enhance().

5. **Default agents are a subset**: Only 9 agents in the default list. Users can customize via config. The full 19-agent catalog is available through config overrides.

6. **healthCheck() always healthy**: The provider itself is always operational. Actual OMC runtime health is monitored by story 58-6 (circuit breaker).

### Anti-Patterns to Avoid

- **DO NOT** install OMC npm package — that's story 59-3
- **DO NOT** implement model routing logic — that's story 58-4
- **DO NOT** implement CLAUDE.md merge — that's story 59-4 (basic merge only if needed)
- **DO NOT** implement compaction survival hooks — that's story 59-2
- **DO NOT** implement circuit breaker — that's story 58-6
- **DO NOT** modify the Session interface — use metadata field only
- **DO NOT** import from provider-raw — use registry for fallback
- **DO NOT** hardcode model names — use DEFAULT_MODEL_TIERS or config values
- **DO NOT** use `exec` or `execSync` for filesystem operations — use `node:fs/promises` directly
- **DO NOT** leave temp directories after tests — clean up in afterEach

### Limitations (Deferred Items)

1. **OMC tool installation**
   - Status: Deferred - Requires Story 59-3
   - Requires: Auto-install OMC npm package in worktree
   - Epic: Story 59-3
   - Current: Provider creates directory structure only

2. **CLAUDE.md merge**
   - Status: Deferred - Requires Story 59-4
   - Requires: Full merge strategy with OMC markers
   - Epic: Story 59-4
   - Current: Basic omc.jsonc generation only

3. **Model routing execution**
   - Status: Deferred - Requires Story 58-4
   - Requires: Auto-escalation, failure tracking
   - Epic: Story 58-4
   - Current: Config contains tierModels but no routing logic

### Project Structure Notes

- New package: `packages/plugins/provider-omc/` — follows existing plugin directory convention
- Modified: `packages/core/src/plugin-registry.ts` — add omc to BUILTIN_PLUGINS
- No changes to: types.ts, config.ts, session-manager.ts, index.ts (all provider infrastructure already exists)
- No web/dashboard changes in this story

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 58, Story 58-3 definition]
- [Source: `_bmad-output/implementation-artifacts/58-1-session-enhancement-provider-interface.md` — provider interface and spawn integration]
- [Source: `_bmad-output/implementation-artifacts/58-2-provider-configuration-discovery.md` — config passthrough and model tiers]
- [Source: `packages/core/src/types.ts:1204-1241` — SessionEnhancementProvider interface]
- [Source: `packages/core/src/types.ts:148-190` — Session interface with metadata field]
- [Source: `packages/core/src/types.ts:997-1017` — ModelTierMapping and SessionEnhancementConfig]
- [Source: `packages/plugins/provider-raw/src/index.ts` — reference plugin pattern]
- [Source: `packages/core/src/plugin-registry.ts:38-66` — BUILTIN_PLUGINS registration]
- [Source: `packages/core/src/plugin-registry.ts:73-86` — extractPluginConfig passthrough]
- [Source: `_tmp/omc-report/01-architecture.md` — OMC directory structure]
- [Source: `_tmp/omc-report/02-agents.md` — OMC agent catalog]
- [Source: `CLAUDE.md` — TypeScript conventions, plugin pattern, shell command security]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No external debug logs. ESLint hook caught a duplicate import (merged into single import statement). TypeScript typecheck caught `"active"` not in `SessionStatus` union (fixed to `"working"`).

### Completion Notes List

- All 8 acceptance criteria met across 7 implementation tasks
- 16 unit tests covering all 5 provider methods + manifest validation + review fixes, all passing
- No new external dependencies — uses only `node:fs/promises`, `node:path`, and `@composio/ao-core`
- `install()` is idempotent via `mkdir(..., { recursive: true })` and overwriting files
- `configure()` generates omc.jsonc with JSONC comments, agent models, routing config, and features; pre-populates notepad from StoryContext; safe to call without prior install()
- `enhance()` creates a new session object with spread (does not mutate input); injects `omc:agents`, `omc:executionMode`, `omc:configured` metadata keys; error-resilient (returns original on failure)
- `teardown()` removes `.omc/` tree with `{ recursive: true, force: true }`; missing dir is not an error
- `healthCheck()` always returns healthy (actual health monitoring is 58-6)
- Full regression suite: 672+ tests pass across all packages, zero failures

### Code Review Fixes

- **enhance() mutation safety**: Now creates a new session via `{ ...session, metadata }` spread instead of mutating input. Test verifies original session is not modified.
- **configure() standalone safety**: Ensures `.omc/` directory exists before reading/writing notepad. Works correctly when called without prior `install()`.
- **JSONC comments**: omc.jsonc now contains descriptive `//` comments for self-documentation. Test verifies comment presence and parseability.

### File List

- `packages/plugins/provider-omc/package.json` — New plugin package
- `packages/plugins/provider-omc/tsconfig.json` — New package TypeScript config
- `packages/plugins/provider-omc/src/index.ts` — OMCProvider implementation with all 5 methods + helpers
- `packages/plugins/provider-omc/src/__tests__/index.test.ts` — 16 unit tests
- `packages/core/src/plugin-registry.ts` — Added omc provider to BUILTIN_PLUGINS
