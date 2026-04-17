# Story 59.5: Story-Type Hook Configuration

Status: done

## Story

As a developer spawning an enhanced agent session,
I want the orchestrator to configure different hook profiles based on the type of story being worked on,
so that exploration sessions get search/analysis-focused hooks while implementation sessions get persistence and verification hooks.

## Acceptance Criteria

1. **AC1 — `StoryType` type**: A new type `StoryType` is defined in `types.ts` as a union of string literals: `"exploration" | "implementation" | "bugfix" | "review" | "default"`. Exported from `index.ts`.
2. **AC2 — `HookProfile` interface**: A new interface `HookProfile` is defined in `types.ts`:
   ```typescript
   export interface HookProfile {
     /** Which phases to enable hooks for. */
     phases: HookPhase[];
     /** Names of built-in hooks to register. */
     enabledHooks: string[];
     /** Additional metadata passed to hooks via sessionMetadata. */
     metadata: Record<string, string>;
   }
   ```
   Exported from `index.ts`.
3. **AC3 — `HOOK_PROFILES` constant**: A `Record<StoryType, HookProfile>` constant is defined in `hooks.ts` with sensible defaults for each story type:
   - `exploration`: preCompact only, `["notepad"]` hooks, metadata `{ mode: "read-only" }`
   - `implementation`: both phases, `["notepad", "projectMemory"]` hooks, metadata `{ mode: "full", verify: "true" }`
   - `bugfix`: both phases, `["notepad", "projectMemory"]` hooks, metadata `{ mode: "targeted", verify: "true" }`
   - `review`: postCompact only, `["notepad"]` hooks, metadata `{ mode: "read-only" }`
   - `default`: both phases, `["notepad", "projectMemory"]` hooks (same as current `registerDefaultHooks`)
4. **AC4 — `detectStoryType()` function**: A new exported function `detectStoryType(storyId: string, storyTitle?: string): StoryType` in `hooks.ts` that infers the story type from the story ID and title using keyword heuristics:
   - Title/storyId contains "spike", "investigate", "explore", "research" → `"exploration"`
   - Title/storyId contains "fix", "bug", "patch", "hotfix" → `"bugfix"`
   - Title/storyId contains "review", "audit", "refactor" → `"review"`
   - Otherwise → `"default"` (implementation is explicit only, since most stories are implementation)
5. **AC5 — `registerHooksForProfile()` function**: A new exported function `registerHooksForProfile(registry: HookRegistry, profile: HookProfile): void` in `hooks.ts` that selectively registers built-in hooks based on a `HookProfile`. Only registers hooks whose names appear in `profile.enabledHooks`. Respects `profile.phases` — skips phases not listed.
6. **AC6 — `storyType` field on `StoryContext`**: The `StoryContext` interface in `types.ts` gains an optional `storyType?: StoryType` field. The session-manager's spawn flow sets this field by calling `detectStoryType()` with the story ID and title from the enriched story context.
7. **AC7 — Profile-based hook registration in spawn flow**: The session-manager's hook registry initialization (currently lines 726-737) is updated to use `detectStoryType()` + `HOOK_PROFILES[storyType]` + `registerHooksForProfile()` instead of always calling `registerDefaultHooks()`. Falls back to `HOOK_PROFILES["default"]` if story type is undefined.
8. **AC8 — Config override**: The `SessionEnhancementConfig` interface in `types.ts` gains an optional `hookProfile?: Partial<HookProfile>` field. When provided in config, the config override is merged on top of the profile detected from story type. Config parsing in `config.ts` is updated accordingly.
9. **AC9 — Unit tests**: Comprehensive vitest tests covering:
   - `detectStoryType()` correctly classifies exploration/bugfix/review/default keywords
   - `detectStoryType()` with empty/undefined title falls back to `"default"`
   - `HOOK_PROFILES` has all 5 story types with correct structure
   - `registerHooksForProfile()` registers only enabled hooks for listed phases
   - `registerHooksForProfile()` with empty profile registers nothing
   - Profile-based spawn flow uses correct profile for detected story type
   - Config override merges on top of detected profile
   - Backward compatibility: no storyType → uses default profile (same as current `registerDefaultHooks`)

## Tasks / Subtasks

- [x] Task 1: Define types (AC: #1, #2, #6, #8)
  - [x] 1.1 Add `StoryType` union type to `packages/core/src/types.ts`
  - [x] 1.2 Add `HookProfile` interface to `packages/core/src/types.ts`
  - [x] 1.3 Add `storyType?: StoryType` field to `StoryContext` interface
  - [x] 1.4 Add `hookProfile?: Partial<HookProfile>` to `SessionEnhancementConfig`
  - [x] 1.5 Export `StoryType` and `HookProfile` from `packages/core/src/index.ts`

- [x] Task 2: Create profile infrastructure (AC: #3, #4, #5)
  - [x] 2.1 Add `HOOK_PROFILES` constant to `packages/core/src/hooks.ts`
  - [x] 2.2 Implement `detectStoryType(storyId, storyTitle)` — keyword heuristics for classification
  - [x] 2.3 Implement `registerHooksForProfile(registry, profile)` — selective hook registration
  - [x] 2.4 Export new functions and constant from `hooks.ts`
  - [x] 2.5 Add exports to `packages/core/src/index.ts`

- [x] Task 3: Config parsing (AC: #8)
  - [x] 3.1 Add `hookProfile` to `SessionEnhancementConfigSchema` in `packages/core/src/config.ts`
  - [x] 3.2 Define `HookProfileSchema` in `config.ts` with optional `phases`, `enabledHooks`, `metadata` fields

- [x] Task 4: Integration into spawn flow (AC: #6, #7)
  - [x] 4.1 In session-manager spawn flow, after story context enrichment, call `detectStoryType()` and set `storyContext.storyType`
  - [x] 4.2 Replace `registerDefaultHooks(hookRegistry)` with profile-based registration: get profile from `HOOK_PROFILES[storyType]`, merge config override if present, call `registerHooksForProfile()`
  - [x] 4.3 Wrap in try/catch — profile detection failure falls back to `HOOK_PROFILES["default"]`

- [x] Task 5: Unit tests (AC: #9)
  - [x] 5.1 Create test section for `detectStoryType()` in `packages/core/src/__tests__/hooks.test.ts`
  - [x] 5.2 Test exploration keywords: "spike", "investigate", "explore", "research"
  - [x] 5.3 Test bugfix keywords: "fix", "bug", "patch", "hotfix"
  - [x] 5.4 Test review keywords: "review", "audit", "refactor"
  - [x] 5.5 Test default fallback for generic titles
  - [x] 5.6 Test with undefined/empty title
  - [x] 5.7 Test `HOOK_PROFILES` has all 5 keys with correct structure
  - [x] 5.8 Test `registerHooksForProfile()` with full profile
  - [x] 5.9 Test `registerHooksForProfile()` with empty enabledHooks
  - [x] 5.10 Test `registerHooksForProfile()` with limited phases
  - [x] 5.11 Test config override merges on top of detected profile (verified in session-manager spawn flow)
  - [x] 5.12 Test backward compatibility: no storyType → default profile

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

Agent mapping per story type is deferred to Story 59-6.
Persistence-aware session timeout leveraging hook state is deferred to Story 59-7.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `createHookRegistry()` — from `hooks.ts` (Story 59-2), returns `HookRegistry`
- [x] `registry.register(phase, name, hook)` — existing `HookRegistry.register()` method
- [x] `notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact` — existing built-in hooks
- [x] `StoryContext.storyType` — NEW field added by this story
- [x] `SessionEnhancementConfig.hookProfile` — NEW optional config override

**Feature Flags:**
- Story-type hook profiles are only applied when a non-raw provider is active. Raw sessions skip hook registration entirely (existing behavior).

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses only existing types and modules.

## Dev Notes

### Architecture Context

This story builds the **story-type hook profile** layer on top of the compaction survival hooks from Story 59-2. Currently, every non-raw session gets the same set of default hooks (`notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact`). This story makes hook registration **adaptive** based on what kind of work the agent is doing.

**What Story 59-2 built (foundation):**
- `HookPhase`, `PreCompactHook`, `PostCompactHook` types
- `HookRegistry` interface with `register()`, `runPreCompact()`, `runPostCompact()`
- `createHookRegistry()` factory
- Three built-in hooks: `notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact`
- `registerDefaultHooks(registry)` — registers all three hooks unconditionally

**What 59-5 adds (THIS STORY):**
- `StoryType` union type — 5 story type classifications
- `HookProfile` interface — declares which hooks/phases to enable
- `HOOK_PROFILES` constant — per-story-type profiles with sensible defaults
- `detectStoryType()` — keyword-based classification from story ID/title
- `registerHooksForProfile()` — selective hook registration based on profile
- `storyType` field on `StoryContext` — flows type info through spawn
- Config override for per-project profile customization

### Current Hook Registration (session-manager.ts lines 726-737)

```typescript
// Current code — unconditional default hooks
let hookRegistry: HookRegistry | undefined;
if (activeProvider && activeProvider.name !== "raw") {
  try {
    const { createHookRegistry, registerDefaultHooks } = await import("./hooks.js");
    hookRegistry = createHookRegistry();
    registerDefaultHooks(hookRegistry);  // ← THIS BECOMES PROFILE-AWARE
  } catch {
    // Hook registry failure must never block spawning
  }
}
```

**After this story:**
```typescript
let hookRegistry: HookRegistry | undefined;
if (activeProvider && activeProvider.name !== "raw") {
  try {
    const { createHookRegistry, registerHooksForProfile, detectStoryType, HOOK_PROFILES } = await import("./hooks.js");
    hookRegistry = createHookRegistry();
    const storyType = detectStoryType(storyContext.storyId, storyContext.storyTitle);
    storyContext.storyType = storyType;
    let profile = HOOK_PROFILES[storyType];
    // Merge config override if present
    if (project.sessionEnhancement?.hookProfile) {
      profile = { ...profile, ...project.sessionEnhancement.hookProfile };
    }
    registerHooksForProfile(hookRegistry, profile);
  } catch {
    // Hook registry failure must never block spawning
  }
}
```

### Key Design Decisions

1. **Keyword-based detection, not ML**: `detectStoryType()` uses simple string matching on the story ID and title. This is deterministic, fast, and requires no external dependencies. If no keywords match, it defaults to `"default"` which gives the same behavior as today.

2. **`"implementation"` is explicit-only**: Most stories ARE implementation, so detection defaults to `"default"` (which IS implementation mode). The `"implementation"` type exists for explicit config override when you want to be specific.

3. **Profile as data, not code**: `HOOK_PROFILES` is a plain `Record<StoryType, HookProfile>` constant. Adding a new story type means adding one entry to this constant. No factory functions, no class hierarchies.

4. **Config override uses `Partial<HookProfile>`**: The config override is merged via spread: `{ ...baseProfile, ...configOverride }`. This lets users customize individual fields (e.g., just `metadata`) without repeating the whole profile.

5. **Backward compatibility is guaranteed**: If `storyType` is undefined (no story artifact, no enrichment), the flow falls back to `HOOK_PROFILES["default"]` which registers the same hooks as today's `registerDefaultHooks()`. Zero behavioral change for existing sessions.

6. **Built-in hooks remain in hooks.ts**: The existing `notepadPreCompact`, `notepadPostCompact`, `projectMemoryPreCompact` functions don't change. `registerHooksForProfile()` just selectively registers them based on the profile.

7. **No new hook phases**: This story does NOT add new hook phases beyond `"preCompact"` and `"postCompact"`. Future phases (e.g., `"preSpawn"`, `"postComplete"`) can be added later.

### Hook Profile Definitions

```typescript
export const HOOK_PROFILES: Record<StoryType, HookProfile> = {
  exploration: {
    phases: ["preCompact"],
    enabledHooks: ["notepad"],
    metadata: { mode: "read-only" },
  },
  implementation: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: { mode: "full", verify: "true" },
  },
  bugfix: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: { mode: "targeted", verify: "true" },
  },
  review: {
    phases: ["postCompact"],
    enabledHooks: ["notepad"],
    metadata: { mode: "read-only" },
  },
  default: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: {},
  },
};
```

### Keyword Detection Rules

```typescript
export function detectStoryType(storyId: string, storyTitle?: string): StoryType {
  const combined = `${storyId} ${storyTitle ?? ""}`.toLowerCase();

  if (/\b(spike|investigat|explor|research)/.test(combined)) return "exploration";
  if (/\b(fix|bug|patch|hotfix)/.test(combined)) return "bugfix";
  if (/\b(review|audit|refactor)/.test(combined)) return "review";

  return "default";
}
```

Note: Uses partial words like `"investigat"` to match both `"investigate"` and `"investigation"`, `"explor"` to match `"explore"` and `"exploration"`. The `\b` is only at the start (not trailing) so prefix matches work correctly.

### File Change Impact

| File | Change | Why |
|------|--------|-----|
| `packages/core/src/hooks.ts` | MODIFY | Add HOOK_PROFILES, detectStoryType, registerHooksForProfile |
| `packages/core/src/types.ts` | MODIFY | Add StoryType, HookProfile, storyType on StoryContext, hookProfile on SessionEnhancementConfig |
| `packages/core/src/config.ts` | MODIFY | Add HookProfileSchema and hookProfile to SessionEnhancementConfigSchema |
| `packages/core/src/index.ts` | MODIFY | Export StoryType, HookProfile |
| `packages/core/src/session-manager.ts` | MODIFY | Replace registerDefaultHooks with profile-based registration, set storyContext.storyType |
| `packages/core/src/__tests__/hooks.test.ts` | MODIFY | Add tests for detectStoryType, HOOK_PROFILES, registerHooksForProfile |
| `_bmad-output/implementation-artifacts/59-5-story-type-hook-configuration.md` | NEW | This story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY | 59-5 status updated |

### Import Conventions (MUST follow)

- **Relative imports**: Always use `.js` extension: `import { foo } from "./bar.js"`
- **Node builtins**: Always use `node:` prefix: `import { readFile } from "node:fs/promises"`
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Package imports**: `import type { HookProfile, StoryType } from "./types.js"`

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

- **DO NOT** change the `HookRegistry` interface — it's already stable from 59-2
- **DO NOT** change the built-in hook implementations — they work correctly as-is
- **DO NOT** add new hook phases — future work
- **DO NOT** add a `storyType` field to `SessionSpawnConfig` — story type is derived, not user-specified
- **DO NOT** use ML or external services for story type detection — simple keyword matching only
- **DO NOT** break backward compatibility — sessions without story artifacts must work identically to today
- **DO NOT** add external dependencies — this is pure TypeScript logic

### Limitations (Deferred Items)

1. **Agent mapping per story type**
   - Status: Deferred — Story 59-6
   - Requires: Story-to-agent mapping configuration
   - Current: No story-specific agent selection

2. **Persistence-aware session timeout**
   - Status: Deferred — Story 59-7
   - Requires: Timeout extension based on hook state
   - Current: All sessions use same timeout

3. **Custom hook registration per story**
   - Status: Deferred — would require plugin hooks API
   - Requires: Ability to register arbitrary hooks per story
   - Current: Only built-in hooks (notepad, projectMemory) are available

4. **Hook profiles in provider plugin config**
   - Status: Deferred — would require provider interface change
   - Requires: Provider-specific hook profile definitions
   - Current: Profiles are hardcoded in HOOK_PROFILES constant

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 59, Story 59-5 definition, FR-S2-3]
- [Source: `packages/core/src/hooks.ts` — createHookRegistry, registerDefaultHooks, built-in hooks]
- [Source: `packages/core/src/types.ts:1250-1278` — HookPhase, PreCompactHook, PostCompactHook, HookRegistry]
- [Source: `packages/core/src/types.ts:1209-1220` — StoryContext interface]
- [Source: `packages/core/src/types.ts:1036-1045` — SessionEnhancementConfig interface]
- [Source: `packages/core/src/config.ts:93-104` — SessionEnhancementConfigSchema]
- [Source: `packages/core/src/session-manager.ts:726-737` — Current hook registry initialization in spawn()]
- [Source: `packages/core/src/session-manager.ts:627-683` — Story context construction and enrichment]
- [Source: `packages/core/src/__tests__/hooks.test.ts` — Existing hook tests]
- [Source: `_bmad-output/implementation-artifacts/59-2-compaction-survival-hooks.md` — Previous story learnings]
- [Source: `_bmad-output/implementation-artifacts/59-4-claudemd-merge-strategy.md` — Previous story learnings]
- [Source: `CLAUDE.md` — TypeScript conventions, ESM imports, shell command security]

### Previous Story Intelligence (59-2, 59-4)

**Key learnings from previous stories that impact this story:**

1. **Atomic writes are critical**: The notepad and hooks modules use temp-file-then-rename for all writes. This story doesn't write files (it's pure in-memory logic), but if any file writes are added later, follow the pattern.

2. **Best-effort enrichment pattern**: Story context enrichment, verification, and hook registry all wrap in try/catch so failures never block spawn. The profile detection MUST follow the same pattern — if `detectStoryType()` throws, fall back to `"default"`.

3. **Convention over interface changes**: 59-3 and 59-4 both chose convention files over adding methods to `SessionEnhancementProvider`. This story adds fields to existing interfaces (`StoryContext`, `SessionEnhancementConfig`) but does NOT add methods. Config overrides use the existing optional field pattern.

4. **Static imports preferred**: 59-3 code review converted dynamic imports to static in session-manager.ts. The hook registry section currently uses dynamic import (`await import("./hooks.js")`) — keep this pattern since it's already established in that section.

5. **ESLint caught unused imports**: Previous stories had issues with unused imports. Be careful to only import what's used.

6. **Hook registry is per-session**: Each spawn gets its own registry. Profile detection runs once per spawn and is not shared across sessions.

7. **`registerDefaultHooks` is used by tests**: Several test files mock `registerDefaultHooks`. After this story, those tests should still pass because the fallback to `HOOK_PROFILES["default"]` registers the same hooks.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed trailing `\b` in STORY_TYPE_PATTERNS regex — partial word patterns like `investigat` and `explor` need `\b` only at the start, not the end, since they match word prefixes.

### Completion Notes List

1. Trailing `\b` removed from keyword patterns in `STORY_TYPE_PATTERNS` — the prefix patterns (`investigat`, `explor`) are designed to match partial words, so a trailing word boundary prevented matches like "investigate" and "exploration".
2. All 17 new tests pass alongside 27 existing tests in `hooks.test.ts` (44 total).
3. Full core test suite passes: 129 test files, 2428 tests passed.
4. Backward compatibility verified: `HOOK_PROFILES["default"]` registers identical hooks to `registerDefaultHooks()`.
5. Config override deep-merges metadata: `{ ...profile, ...configOverride, metadata: { ...profile.metadata, ...configOverride.metadata } }`.
6. Code review fix: `profile.metadata` wired into `session.metadata` so hooks receive story-type context (e.g., `mode: "read-only"`) during pre-compact.

### File List

| File | Change |
|------|--------|
| `packages/core/src/hooks.ts` | MODIFY — Add HOOK_PROFILES, detectStoryType, registerHooksForProfile; fix trailing `\b` in STORY_TYPE_PATTERNS regex |
| `packages/core/src/types.ts` | MODIFY — Add StoryType, HookProfile, storyType field, hookProfile config |
| `packages/core/src/config.ts` | MODIFY — Add HookProfileSchema |
| `packages/core/src/index.ts` | MODIFY — Export StoryType, HookProfile |
| `packages/core/src/session-manager.ts` | MODIFY — Profile-based hook registration, wire profile.metadata into session.metadata, deep-merge config override |
| `packages/core/src/__tests__/hooks.test.ts` | MODIFY — Tests for new functions |
| `_bmad-output/implementation-artifacts/59-5-story-type-hook-configuration.md` | NEW — This story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFY — 59-5 status updated |
