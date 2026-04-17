# Story 59.6: Story-Agent Mapping Configuration

Status: done

## Story

As a developer spawning an enhanced agent session,
I want the orchestrator to map story types to OMC agent combinations so that bugfix stories get diagnostic agents while feature stories get planning and execution agents,
so that each story type automatically receives the most effective sub-agent team.

## Acceptance Criteria

1. **AC1 — `AgentMapping` interface**: A new interface `AgentMapping` is defined in `types.ts`:
   ```typescript
   export interface AgentMapping {
     /** OMC agent names to activate for this story type. */
     agents: string[];
     /** Execution mode hint for the provider. */
     executionMode?: "standard" | "persistent" | "lightweight";
   }
   ```
   Exported from `index.ts`.
2. **AC2 — `DEFAULT_AGENT_MAPPINGS` constant**: A `Record<StoryType, AgentMapping>` constant is defined in a new module `agent-mapping.ts` with sensible defaults:
   - `exploration`: `{ agents: ["searcher", "analyzer"], executionMode: "lightweight" }`
   - `implementation`: `{ agents: ["planner", "architect", "executor", "verifier"], executionMode: "standard" }`
   - `bugfix`: `{ agents: ["tracer", "debugger", "verifier"], executionMode: "standard" }`
   - `review`: `{ agents: ["reviewer"], executionMode: "lightweight" }`
   - `default`: `{ agents: ["planner", "executor", "verifier"], executionMode: "standard" }`
3. **AC3 — `resolveAgentMapping()` function**: A new exported function `resolveAgentMapping(storyType: StoryType, configOverride?: Record<string, AgentMapping>): AgentMapping` in `agent-mapping.ts` that:
   - Returns `DEFAULT_AGENT_MAPPINGS[storyType]` as the base
   - If `configOverride` is provided and has an entry for `storyType`, deep-merges it over the default
   - Falls back to `DEFAULT_AGENT_MAPPINGS["default"]` if `storyType` is undefined or not in the mapping
4. **AC4 — `agentMappings` field on `SessionEnhancementConfig`**: The `SessionEnhancementConfig` interface in `types.ts` gains an optional `agentMappings?: Record<string, AgentMapping>` field. The Zod schema in `config.ts` gains an `AgentMappingSchema` and `agentMappings` field.
5. **AC5 — `agents` field on `StoryContext`**: The `StoryContext` interface gains an optional `agents?: AgentMapping` field. During spawn, after `detectStoryType()` resolves the story type, the agent mapping is resolved and set on `storyContext.agents`.
6. **AC6 — Agent mapping in spawn flow**: The session-manager spawn flow (after story-type hook detection) calls `resolveAgentMapping()` with the detected story type and the project's `sessionEnhancement.agentMappings` config override. The resolved mapping is set on `storyContext.agents` and passed to the provider via the existing `provider.configure()` call.
7. **AC7 — Story-level override**: When the implementation artifact for a story contains a `<!-- ao-agents: [...] -->` HTML comment in the Dev Notes section, the parser extracts the JSON array and uses it as the agent list override. This is parsed during the existing artifact enrichment step (session-manager.ts lines 637-684).
8. **AC8 — Unit tests**: Comprehensive vitest tests covering:
   - `resolveAgentMapping()` returns correct default for each story type
   - `resolveAgentMapping()` deep-merges config override
   - `resolveAgentMapping()` falls back to "default" for undefined story type
   - `DEFAULT_AGENT_MAPPINGS` has all 5 story types
   - `AgentMappingSchema` validates and rejects invalid input
   - Story-level `<!-- ao-agents -->` comment parsing extracts agent list
   - Spawn flow integration: storyContext.agents is populated for non-raw providers
   - Backward compatibility: no agentMappings config → uses defaults

## Tasks / Subtasks

- [x] Task 1: Define types (AC: #1, #4, #5)
  - [x] 1.1 Add `AgentMapping` interface to `packages/core/src/types.ts`
  - [x] 1.2 Add `agentMappings?: Record<string, AgentMapping>` to `SessionEnhancementConfig`
  - [x] 1.3 Add `agents?: AgentMapping` to `StoryContext` interface
  - [x] 1.4 Export `AgentMapping` from `packages/core/src/index.ts`

- [x] Task 2: Create agent mapping module (AC: #2, #3)
  - [x] 2.1 Create `packages/core/src/agent-mapping.ts`
  - [x] 2.2 Define `DEFAULT_AGENT_MAPPINGS: Record<StoryType, AgentMapping>` constant
  - [x] 2.3 Implement `resolveAgentMapping(storyType, configOverride)` function
  - [x] 2.4 Export functions and constant from `agent-mapping.ts`

- [x] Task 3: Config parsing (AC: #4)
  - [x] 3.1 Add `AgentMappingSchema` in `packages/core/src/config.ts`
  - [x] 3.2 Add `agentMappings` to `SessionEnhancementConfigSchema`

- [x] Task 4: Story-level override parsing (AC: #7)
  - [x] 4.1 In session-manager spawn flow artifact enrichment, add parsing for `<!-- ao-agents: [...] -->` HTML comment
  - [x] 4.2 If found, parse JSON array and create an `AgentMapping` override with those agents

- [x] Task 5: Integration into spawn flow (AC: #5, #6)
  - [x] 5.1 After `detectStoryType()`, call `resolveAgentMapping()` with story type and config override
  - [x] 5.2 Set `storyContext.agents` with resolved mapping
  - [x] 5.3 If story-level override was parsed, merge it as highest priority
  - [x] 5.4 Wrap in try/catch — mapping failure falls back to defaults

- [x] Task 6: Unit tests (AC: #8)
  - [x] 6.1 Create `packages/core/src/__tests__/agent-mapping.test.ts`
  - [x] 6.2 Test `resolveAgentMapping()` for each story type
  - [x] 6.3 Test config override deep-merge
  - [x] 6.4 Test undefined story type fallback
  - [x] 6.5 Test `DEFAULT_AGENT_MAPPINGS` completeness
  - [x] 6.6 Test `AgentMappingSchema` validation
  - [x] 6.7 Test `<!-- ao-agents -->` comment parsing
  - [x] 6.8 Test spawn flow integration
  - [x] 6.9 Test backward compatibility

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

Persistence-aware session timeout leveraging agent mapping is deferred to Story 59-7.
Dashboard display of active agent mapping per session is deferred to Epic 60.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `detectStoryType()` — from `hooks.ts` (Story 59-5), returns `StoryType`
- [x] `StoryContext.agents` — NEW field added by this story
- [x] `provider.configure(worktreePath, storyContext)` — existing `SessionEnhancementProvider.configure()`
- [x] `SessionEnhancementConfig.agentMappings` — NEW optional config field

**Feature Flags:**
- Agent mapping is only resolved for non-raw providers. Raw sessions skip agent mapping entirely.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only existing types and modules.

## Dev Notes

### Architecture Context

This story builds the **story-to-agent mapping** layer that determines which OMC sub-agents are activated for each story type. It sits alongside the hook profile system from Story 59-5 — while 59-5 controls which *hooks* run, this story controls which *agents* are enabled.

**What Story 59-5 built (sibling feature):**
- `StoryType` union type and `detectStoryType()` function
- `HookProfile` interface and `HOOK_PROFILES` constant
- `registerHooksForProfile()` for selective hook registration
- `storyType` field on `StoryContext`

**What 59-6 adds (THIS STORY):**
- `AgentMapping` interface — declares which agents and execution mode
- `DEFAULT_AGENT_MAPPINGS` constant — per-story-type agent teams
- `resolveAgentMapping()` — resolves mapping with config cascade
- `agents` field on `StoryContext` — flows mapping through spawn
- Story-level override via `<!-- ao-agents -->` HTML comment

### Current Spawn Flow (session-manager.ts lines 726-756)

After the hook registry initialization, this story adds agent mapping resolution:

```typescript
// AFTER hook registry (lines 726-756) — ADD agent mapping:
let resolvedAgentMapping: AgentMapping | undefined;
if (activeProvider && activeProvider.name !== "raw") {
  try {
    const { resolveAgentMapping } = await import("./agent-mapping.js");
    resolvedAgentMapping = resolveAgentMapping(
      storyContext.storyType,
      project.sessionEnhancement?.agentMappings,
    );
    storyContext.agents = resolvedAgentMapping;
  } catch {
    // Agent mapping failure must never block spawning
  }
}
```

### Config Cascade

Three levels of override, highest priority wins:

1. **Story-level override** (`<!-- ao-agents: [...] -->` in artifact) — highest
2. **Project config** (`session_enhancement.agent_mappings` in YAML)
3. **Defaults** (`DEFAULT_AGENT_MAPPINGS` constant) — lowest

This matches the existing config cascade pattern used by model tiers, hook profiles, and provider resolution.

### Story-Level Override Syntax

In a story's Dev Notes section, developers can specify which agents to use:

```markdown
<!-- ao-agents: ["tracer", "debugger", "verifier"] -->
```

The parser looks for this HTML comment during artifact enrichment (session-manager.ts lines 637-684). If found, it overrides the config-level and default mappings.

### Default Agent Mappings

| Story Type | Agents | Execution Mode |
|------------|--------|----------------|
| exploration | searcher, analyzer | lightweight |
| implementation | planner, architect, executor, verifier | standard |
| bugfix | tracer, debugger, verifier | targeted |
| review | reviewer | lightweight |
| default | planner, executor, verifier | standard |

These agent names correspond to OMC's built-in agent catalog. The mapping is a hint — the provider may ignore agents it doesn't recognize.

### Key Design Decisions

1. **Agent names are strings, not types**: Agent names match OMC's agent catalog. This keeps the mapping simple and provider-agnostic.

2. **`executionMode` is a hint**: The field is optional and advisory. Providers use it to decide session behavior (e.g., persistent mode extends timeout). If the provider doesn't support the mode, it falls back to standard.

3. **Story-level override uses HTML comment**: This avoids adding a new structured field to the markdown story files. The comment is invisible in rendered markdown but parseable. The `<!-- ao-agents -->` prefix prevents collision with other comments.

4. **Separate module from hooks.ts**: Agent mapping is a distinct concern from hook registration. It gets its own file (`agent-mapping.ts`) for clean separation.

5. **Backward compatibility guaranteed**: No `agentMappings` config → `resolveAgentMapping()` returns `DEFAULT_AGENT_MAPPINGS[storyType]`. No `storyType` → returns `DEFAULT_AGENT_MAPPINGS["default"]`. Zero behavioral change for sessions without agent mapping.

6. **Provider receives mapping via existing `configure()` call**: The `StoryContext` already flows to `provider.configure()`. Adding the `agents` field means the provider gets the mapping without any interface changes.

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

- **DO NOT** change the `SessionEnhancementProvider` interface — it already receives `StoryContext`
- **DO NOT** add agent mapping logic to `hooks.ts` — separate concern
- **DO NOT** validate agent names against a known catalog — new agents may be added by providers
- **DO NOT** make agent mapping blocking — failure falls back to defaults
- **DO NOT** add external dependencies — this is pure TypeScript logic

### Limitations (Deferred Items)

1. **Persistence-aware session timeout**
   - Status: Deferred — Story 59-7
   - Requires: Timeout extension based on `executionMode` in agent mapping
   - Current: All sessions use same timeout regardless of execution mode

2. **Dashboard display of agent mapping**
   - Status: Deferred — Epic 60
   - Requires: API route and panel component to display active agents per session
   - Current: Agent mapping is internal to spawn flow

3. **Agent affinity scoring**
   - Status: Deferred — future enhancement
   - Requires: Track which agent combinations produce best outcomes per story type
   - Current: Static mapping, no learning

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 59, Story 59-6 definition, FR-S3-1, FR-S3-2, FR-S3-3]
- [Source: `packages/core/src/types.ts:1260-1271` — StoryType, HookProfile types]
- [Source: `packages/core/src/types.ts:1036-1047` — SessionEnhancementConfig interface]
- [Source: `packages/core/src/types.ts:1211-1224` — StoryContext interface]
- [Source: `packages/core/src/config.ts:93-111` — SessionEnhancementConfigSchema, HookProfileSchema]
- [Source: `packages/core/src/hooks.ts:257-307` — detectStoryType, HOOK_PROFILES (pattern to follow)]
- [Source: `packages/core/src/session-manager.ts:726-756` — Hook registry initialization (insertion point)]
- [Source: `packages/core/src/session-manager.ts:637-684` — Artifact enrichment (ao-agents parsing)]
- [Source: `packages/core/src/session-manager.ts:685-724` — Provider configure() call (StoryContext flows here)]
- [Source: `_bmad-output/implementation-artifacts/59-5-story-type-hook-configuration.md` — Previous story learnings]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, shell command security]

### Previous Story Intelligence (59-5)

**Key learnings from 59-5 that impact this story:**

1. **Keyword-based detection already exists**: `detectStoryType()` from 59-5 returns `StoryType`. This story reuses that function to look up agent mappings. No need to duplicate detection logic.

2. **Config cascade pattern established**: 59-5 used `{ ...profile, ...configOverride, metadata: { ...profile.metadata, ...configOverride.metadata } }` for deep-merge. This story follows the same pattern for merging agent mapping overrides.

3. **Best-effort enrichment pattern**: Story context enrichment, hook registry, and agent mapping all wrap in try/catch so failures never block spawn. The agent mapping MUST follow the same pattern.

4. **Dynamic imports for spawn flow**: The hook registry uses `await import("./hooks.js")`. Agent mapping should use `await import("./agent-mapping.js")` for consistency.

5. **Profile metadata wired into session.metadata**: 59-5 wires `profile.metadata` into `session.metadata` for hook access. Similarly, the resolved agent mapping should be available to the provider via `storyContext.agents`.

6. **Static imports preferred outside spawn**: Module-level code uses static imports. Only the spawn flow uses dynamic imports for optional features.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `executionMode: "targeted"` in bugfix default — not a valid enum value. Changed to `"standard"`.
- Code review: deep-copy override.agents array for mutation safety (was referencing config object directly).
- Code review: removed redundant `as Record<string, AgentMapping>` cast in session-manager.ts (type already correct).
- Code review: imported actual `AgentMappingSchema` from config.ts in tests instead of recreating locally.
- Code review: replaced `match!` non-null assertions with `if (!match) return` guards for type narrowing.
- Code review: added mutation-safety test proving override agents are deep-copied.

### Completion Notes List

1. `AgentMapping` interface added to types.ts with `agents: string[]` and optional `executionMode`.
2. `DEFAULT_AGENT_MAPPINGS` constant in `agent-mapping.ts` with 5 story-type entries (exploration, implementation, bugfix, review, default).
3. `resolveAgentMapping()` returns a deep copy (agents array spread) to prevent mutation of defaults.
4. Config override cascade: story-level `<!-- ao-agents -->` > project config > defaults.
5. `AgentMappingSchema` added to config.ts with Zod validation for agents array (min 1) and executionMode enum.
6. `storyOverrideAgents` variable in spawn flow captures `<!-- ao-agents -->` from artifact enrichment.
7. Agent mapping resolution runs after hook registry, uses dynamic import pattern consistent with 59-5.
8. All 32 tests pass (31 original + 1 mutation-safety test added in code review).

### File List

| File | Change |
|------|--------|
| `packages/core/src/agent-mapping.ts` | NEW — DEFAULT_AGENT_MAPPINGS, resolveAgentMapping |
| `packages/core/src/types.ts` | MODIFY — Add AgentMapping, agentMappings on SessionEnhancementConfig, agents on StoryContext |
| `packages/core/src/config.ts` | MODIFY — Add AgentMappingSchema and agentMappings to SessionEnhancementConfigSchema |
| `packages/core/src/index.ts` | MODIFY — Export AgentMapping |
| `packages/core/src/session-manager.ts` | MODIFY — Agent mapping resolution in spawn flow, ao-agents comment parsing |
| `packages/core/src/__tests__/agent-mapping.test.ts` | NEW — 31 tests for agent mapping functions |
| `_bmad-output/implementation-artifacts/59-6-story-agent-mapping-configuration.md` | NEW — This story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-6 status updated |
