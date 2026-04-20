# Story 61.1: Cross-Session Memory Bridge

Status: done

## Story

As a project lead running multiple agent sessions,
I want knowledge from completed sessions to automatically flow into new sessions,
so that each session benefits from accumulated conventions, decisions, and learnings across the entire project.

## Acceptance Criteria

1. **AC#1 — Completion Extraction**: When a session completes, the system reads `.omc/project-memory.json` from the session's workspace and extracts all entries (conventions, decisions, directives, learnings)
2. **AC#2 — Deduplication**: Entries are deduplicated by content hash before merging — identical content from different sessions is stored once with multiple source references
3. **AC#3 — Project-Level JSONL Store**: Extracted entries are persisted to a project-level JSONL file at `{projectDir}/.omc/cross-session-memory.jsonl` (one JSON object per line)
4. **AC#4 — Spawn Injection**: When a new session spawns, accumulated cross-session memory entries are injected into the session prompt (gated on config `project.learning.crossSessionMemory`)
5. **AC#5 — Non-Fatal Enrichment**: Bridge failures (read errors, parse errors, disk issues) never break the completion or spawn flow — logged but silently skipped
6. **AC#6 — No File Contents**: Only metadata and typed knowledge entries are stored — never file contents (NFR-AI-S1 security requirement)
7. **AC#7 — Config Gate**: Bridge is opt-in via `project.learning.crossSessionMemory: boolean` in agent-orchestrator.yaml
8. **AC#8 — Test Coverage**: Unit tests for extraction, deduplication, merge, injection, and error handling

## Tasks / Subtasks

- [x] Task 1: Define types and config (AC: #7)
  - [x] Add `CrossSessionMemoryConfig` to `types.ts` under existing `ProjectConfig.learning`
  - [x] Add `CrossSessionMemoryEntry` type extending `ProjectMemoryEntry` with dedup fields
  - [x] Update `LearningConfig` type to include `crossSessionMemory?: boolean`
- [x] Task 2: Create memory-bridge core module (AC: #1, #2, #3)
  - [x] Create `packages/core/src/memory-bridge.ts`
  - [x] Implement `extractMemoryFromWorkspace(workspacePath): ProjectMemoryEntry[]` — reads `.omc/project-memory.json`, returns entries
  - [x] Implement `deduplicateEntries(existing, incoming): CrossSessionMemoryEntry[]` — content-hash dedup, merges source references
  - [x] Implement `persistEntries(projectDir, entries): Promise<void>` — append-only JSONL to `.omc/cross-session-memory.jsonl`
  - [x] Implement `loadAccumulatedMemory(projectDir): CrossSessionMemoryEntry[]` — reads full JSONL, tolerates malformed lines
  - [x] Use atomic write pattern (temp file + rename) for JSONL rotation
  - [x] Use `content-hash` (MD5 of type+content) for dedup key
- [x] Task 3: Wire into completion flow (AC: #1, #5)
  - [x] Modify `packages/core/src/completion-handlers.ts` — call `extractAndBridgeMemory()` after existing learning capture
  - [x] Wrap in try/catch with `process.stderr.write` — must never break completion
  - [-] Only runs if workspace path exists in metadata (config gate deferred — extraction always runs, gating enforced at spawn side)
- [x] Task 4: Wire into spawn flow (AC: #4, #5)
  - [x] Modify `packages/core/src/session-manager.ts` — in spawn flow after `buildLearningsLayer`, add `buildCrossSessionMemoryLayer()`
  - [x] Reads accumulated memory, formats as structured text block for prompt injection
  - [x] Wrapped in try/catch — spawn must succeed even if bridge fails
  - [x] Only runs if `config.learning?.crossSessionMemory` is true
- [x] Task 5: Register in service registry (AC: #3)
  - [x] Skipped — bridge functions are stateless pure functions, no service instance needed
- [x] Task 6: Export from index.ts and package.json (AC: #8)
  - [x] Add exports to `packages/core/src/index.ts`
  - [x] Add sub-path export `@composio/ao-core/memory-bridge` to `package.json`
- [x] Task 7: Write comprehensive tests (AC: #8)
  - [x] Create `packages/core/src/__tests__/memory-bridge.test.ts`
  - [x] Test extraction from valid workspace memory
  - [x] Test extraction from missing/empty workspace (returns empty)
  - [x] Test extraction from legacy format memory
  - [x] Test deduplication: identical content → merged sources
  - [x] Test deduplication: different content → kept separate
  - [x] Test JSONL persistence and loading
  - [x] Test malformed JSONL lines are tolerated
  - [x] Test rotation when file exceeds 10MB
  - [x] Test non-fatal: errors logged, flow continues

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
- [ ] `readProjectMemory(worktreePath)` — from `project-memory.ts` — reads per-workspace memory
- [ ] `captureSessionLearning(event, projectId, retryCount, worktreePath?)` — from `session-learning.ts` — existing completion capture
- [ ] `SessionManager.spawn(config)` — injects accumulated memory into new session prompt
- [ ] `createCompletionHandler()` — wiring point for bridge extraction
- [ ] `getLearningStore()` — existing service registry pattern

**Feature Flags:**
- [ ] `project.learning.crossSessionMemory` — config gate for entire bridge feature

## Dev Notes

### Architecture Overview

The bridge connects two existing but isolated knowledge systems:

1. **Per-session ProjectMemory** (`.omc/project-memory.json` per workspace) — typed entries (convention, decision, directive, learning) written by compaction hooks and manual edits
2. **Per-project SessionLearning** (`{sessionsDir}/learnings.jsonl`) — session outcome records (completed/failed, files modified, error categories)

Currently these systems don't cross-pollinate. Project memory is lost when a workspace is cleaned up. SessionLearning records contain metadata but not the actual knowledge entries.

The bridge extracts typed knowledge entries from completed sessions' workspaces and persists them to a project-level JSONL store that survives workspace cleanup and feeds into new session prompts.

### Data Flow

```
Session Completes
    ↓
completion-handler.ts → extractAndBridgeMemory()
    ↓
readProjectMemory(workspacePath) → entries[]
    ↓
deduplicate(existing JSONL, new entries) → merged entries
    ↓
persistEntries(projectDir, merged) → append to .omc/cross-session-memory.jsonl

---

New Session Spawns
    ↓
session-manager.ts → buildCrossSessionMemoryLayer()
    ↓
loadAccumulatedMemory(projectDir) → CrossSessionMemoryEntry[]
    ↓
Format as prompt text → inject into session prompt
```

### Key Design Decisions

1. **JSONL, not JSON** — Append-only, rotation-friendly, tolerates partial corruption (same pattern as `learnings.jsonl`)
2. **Content-hash dedup** — `MD5(type + ":" + content)` as dedup key. Same knowledge from multiple sessions gets merged source references
3. **Project-level, not global** — Memory is scoped to `{projectDir}/.omc/` so different projects don't share knowledge
4. **Non-fatal everywhere** — Bridge enrichment wrapped in try/catch at both completion and spawn. Completion and spawn MUST succeed regardless of bridge errors
5. **Config-gated** — Opt-in via `learning.crossSessionMemory: true`. Default off to avoid unexpected behavior

### Project Structure Notes

- New file: `packages/core/src/memory-bridge.ts` — core bridge logic
- New test: `packages/core/src/__tests__/memory-bridge.test.ts`
- Modify: `packages/core/src/completion-handlers.ts` — wire extraction on completion (config-gated)
- Modify: `packages/core/src/session-manager.ts` — wire injection on spawn
- Modify: `packages/core/src/prompt-builder.ts` — add crossSessionMemory field and Layer 5 injection
- Modify: `packages/core/src/types.ts` — add bridge config types
- Modify: `packages/core/src/index.ts` — export new module
- Modify: `packages/core/package.json` — add sub-path export

### Testing Patterns (from Epic 60 lessons)

- Use `vi.hoisted()` for mock references used in `vi.mock()` factories
- Use real timers for async operations (JSONL read/write)
- Use `Object.freeze()` for empty default objects
- Best-effort pattern: test error cases return empty/skip, never throw
- Test malformed input tolerance (legacy format, corrupted JSONL lines)

### Critical Patterns to Follow

- **Atomic writes**: temp file with PID+UUID suffix, then `rename()` (see `writeProjectMemory`)
- **Best-effort I/O**: catch errors, return empty, never throw (see `readProjectMemory`)
- **Append-only JSONL**: same rotation pattern as `learning-store.ts` (10MB max, date-stamped rotation)
- **Service registry**: `registerMemoryBridge()` / `getMemoryBridge()` pattern (see `registerLearningStore`)
- **Config gating**: check `config.learning?.crossSessionMemory` before any bridge work

### References

- [Source: packages/core/src/project-memory.ts] — readProjectMemory, writeProjectMemory patterns
- [Source: packages/core/src/learning-store.ts] — JSONL append-only storage pattern
- [Source: packages/core/src/completion-handlers.ts] — completion wiring point
- [Source: packages/core/src/session-manager.ts:599-616] — learning injection during spawn
- [Source: packages/core/src/session-learning.ts] — captureSessionLearning pattern
- [Source: packages/core/src/types.ts:3554-3569] — ProjectMemory types
- [Source: packages/core/src/types.ts:1858-1884] — SessionLearning type
- [Source: packages/core/src/types.ts:1167] — LearningConfig type

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean build, all 27 tests passing.

### Completion Notes List

- Task 5 (service registry) was intentionally skipped — bridge functions are stateless pure functions with no lifecycle, so direct imports from `memory-bridge.ts` are sufficient. No service instance needed.
- Completion flow extraction is config-gated via `loadConfig(configPath)` — only runs when `project.learning.crossSessionMemory` is true (AC#7).
- `persistEntries` was replaced with `appendEntries` — true append-only JSONL writes. Dedup now happens at load time in `loadAccumulatedMemory()`, eliminating TOCTOU race conditions from read-merge-write cycles.
- `readMetadataRaw` is cached once per completion handler invocation and reused by both model usage tracking and the memory bridge.
- Pre-existing build failure in `packages/web` (notepad stream route type error) is unrelated to this story.

### Code Review Fixes Applied

- **H1**: Added config gate (`loadConfig` + `learning.crossSessionMemory` check) to completion flow extraction
- **H2**: Replaced `persistEntries` (full rewrite) with `appendEntries` (true append-only). Dedup moved to `loadAccumulatedMemory()` — merges duplicate contentHash entries at read time, combining sourceSessionIds
- **H3**: Kept rotation test as-is (uses real file I/O, completes in ~8ms)
- **M1**: Added `prompt-builder.ts` to Project Structure Notes
- **M3**: Cached `readMetadataRaw` result, reused for model usage and bridge extraction
- **L1**: Removed stale `service-registry.ts` reference from Project Structure Notes

### File List

**Created:**
- `packages/core/src/memory-bridge.ts` — core bridge logic (extract, dedup, append, load, injection)
- `packages/core/src/__tests__/memory-bridge.test.ts` — 27 comprehensive tests

**Modified:**
- `packages/core/src/types.ts` — added `CrossSessionMemoryEntry` type, `crossSessionMemory?: boolean` config
- `packages/core/src/index.ts` — added memory-bridge exports and CrossSessionMemoryEntry type export
- `packages/core/package.json` — added `./memory-bridge` sub-path export
- `packages/core/src/completion-handlers.ts` — wired `extractAndBridgeMemory()` with config gate, cached metadata read
- `packages/core/src/session-manager.ts` — wired `buildCrossSessionMemoryLayer()` in spawn flow, passed through to `buildPrompt()`
- `packages/core/src/prompt-builder.ts` — added `crossSessionMemory?: string` field to `PromptBuildConfig`, Layer 5 injection
