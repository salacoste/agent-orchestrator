# Story 62.11: Memory & Learning

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Memory & Learning page documenting the 3-tier memory architecture, Pipeline A (Structured Learnings), Pipeline B (Cross-Session Knowledge), compaction survival, JSONL dedup, and 10MB rotation,
so that I can understand how agents learn from past sessions and how to configure memory for my projects.

## Acceptance Criteria

1. Page documents the 3-tier memory architecture (cross-session, session-persistent, ephemeral) with architecture diagram — sourced from `packages/core/src/memory-bridge.ts` lines 1-14, `packages/core/src/project-memory.ts`, `packages/core/src/prompt-builder.ts` lines 162-196
2. Pipeline A (Structured Learnings) documented: SessionLearning capture (session-learning.ts:79-137), LearningStore JSONL storage (learning-store.ts:48-59), query interface (LearningQuery at learning-store.ts:34-45) — sourced from `packages/core/src/session-learning.ts`, `packages/core/src/learning-store.ts`, `packages/core/src/types.ts` lines 1954-1981
3. Pipeline B (Cross-Session Knowledge) documented: memory bridge extraction (memory-bridge.ts:49-58), dedup by content hash (memory-bridge.ts:35-37, 70-118), append-only JSONL with 10MB rotation (memory-bridge.ts:131-157) — sourced from `packages/core/src/memory-bridge.ts`
4. Prompt injection documented: 5 prompt layers, Layer 4 (past learnings) and Layer 5 (cross-session memory) — sourced from `packages/core/src/prompt-builder.ts` lines 162-196, 211-238
5. Compaction survival documented: projectMemoryPreCompact hook saves `.omc/project-memory.json` before compaction — sourced from `packages/core/src/hooks.ts` lines 189-236, `packages/core/src/project-memory.ts`
6. JSONL dedup and rotation explained: content-hash dedup at load time (not write time) to prevent TOCTOU, 10MB rotation with date-stamped rename — sourced from `memory-bridge.ts:70-118, 131-157, 175-196`
7. Failure pattern detection documented: MIN_PATTERN_THRESHOLD=3, category grouping, suggestAction heuristics — sourced from `packages/core/src/learning-patterns.ts` lines 11-104
8. CLI commands documented: `ao learning-patterns`, `ao agent-history <agent-id>` — sourced from `packages/cli/src/commands/learning-patterns.ts`, `packages/cli/src/commands/agent-history.ts`
9. Configuration reference with YAML example — sourced from `packages/core/src/types.ts` lines 1169-1179 (learning config in ProjectConfig)
10. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 5)
11. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
12. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
13. Links to related pages: Sessions (62-7), Reactions (62-10), Configuration (62-5)
14. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #10, #13, #14)
  - [x] Front matter: title: Memory & Learning, nav_order: 5, parent: Core Concepts, description
  - [x] One-paragraph intro explaining memory as 3-tier learning system
  - [x] TL;DR callout: 2 pipelines, 3 memory tiers, prompt injection, compaction survival
  - [x] No hero-style font classes

- [x] Task 2: Write "Memory Architecture" section (AC: #1, #12)
  - [x] ASCII diagram showing 3-tier architecture (ephemeral, session-persistent, cross-session) under 60 chars wide
  - [x] Tier descriptions: ephemeral (in-context), session-persistent (project-memory.json), cross-session (cross-session-memory.jsonl)
  - [x] Source: prompt-builder.ts:162-196, project-memory.ts, memory-bridge.ts:1-14

- [x] Task 3: Write "Pipeline A: Structured Learnings" section (AC: #2)
  - [x] SessionLearning type table: 13 fields — sourced from types.ts:1954-1981
  - [x] Capture flow: session completes → captureSessionLearning() → LearningStore.store() → learnings.jsonl
  - [x] Domain tag inference: 5 categories (frontend, testing, api, styling, backend) from session-learning.ts:25-41
  - [x] Query interface: LearningQuery params (agentId, domain, outcome, sinceMs, limit) from learning-store.ts:34-45
  - [x] Source: session-learning.ts:79-137, learning-store.ts:48-59, types.ts:1954-1981

- [x] Task 4: Write "Pipeline B: Cross-Session Knowledge" section (AC: #3, #6)
  - [x] Memory bridge extraction flow: session workspace → .omc/project-memory.json → extractMemoryFromWorkspace() → appendEntries()
  - [x] Content-hash dedup: MD5(type + ":" + content), dedup at load time not write time, TOCTOU prevention — memory-bridge.ts:35-37, 70-118
  - [x] JSONL storage: append-only to .omc/cross-session-memory.jsonl — memory-bridge.ts:131-157
  - [x] 10MB rotation: date-stamped rename, configurable threshold — memory-bridge.ts:175-196
  - [x] CrossSessionMemoryEntry: 4 extra fields (contentHash, sourceSessionIds, firstSeenAt, lastSeenAt) — types.ts:3679-3689
  - [x] 4 entry types: convention, decision, directive, learning — types.ts:3659
  - [x] Source: memory-bridge.ts, types.ts:3659-3689

- [x] Task 5: Write "Prompt Injection" section (AC: #4, #12)
  - [x] 5 prompt layers: base prompt, config-derived context, user rules, past learnings, cross-session memory
  - [x] ASCII diagram showing 5-layer prompt composition (under 60 chars)
  - [x] Layer 4 detail: filters to failed/blocked outcomes only, formats as "Lessons from Past Sessions" — prompt-builder.ts:211-238
  - [x] Layer 5 detail: formatted from buildCrossSessionMemoryLayer(), subsections per entry type — memory-bridge.ts:392-422
  - [x] Spawn-time wiring: session-manager.ts:599-627
  - [x] Source: prompt-builder.ts:162-196, 211-238

- [x] Task 6: Write "Compaction Survival" section (AC: #5)
  - [x] projectMemoryPreCompact hook: reads existing memory, merges session metadata learnings, first-write-wins, atomic write
  - [x] Registered at hooks.ts:249
  - [x] .omc/project-memory.json format: ProjectMemory with entries array
  - [x] Provider verification: provider-verify.ts:63-83 checks file exists and is valid JSON
  - [x] Source: hooks.ts:189-236, project-memory.ts

- [x] Task 7: Write "Failure Pattern Detection" section (AC: #7)
  - [x] FailurePattern interface: 5 fields (category, occurrenceCount, affectedStories, lastOccurrence, suggestedAction) — learning-patterns.ts:11-22
  - [x] MIN_PATTERN_THRESHOLD = 3 occurrences — learning-patterns.ts:25
  - [x] suggestAction heuristics: 6 categories (network, parse, auth, disk, exit_code, default) — learning-patterns.ts:28-45
  - [x] Consumers: postmortem-generator.ts:127, learning-patterns CLI command
  - [x] Source: learning-patterns.ts:11-104

- [x] Task 8: Write "CLI Commands" section (AC: #8)
  - [x] `ao learning-patterns` — options (--json), output format (table with Pattern, Count, Stories, Last Seen, Suggested Action)
  - [x] `ao agent-history <agent-id>` — options (--since, --limit, --json), output format (Story, Outcome emoji-coded, Duration, Domains, Date)
  - [x] Source: learning-patterns.ts, agent-history.ts

- [x] Task 9: Write "Configuration" section (AC: #9)
  - [x] YAML example with learning config: injectInPrompts, injectFindings, retentionDays, crossSessionMemory
  - [x] Default values: injectInPrompts false, injectFindings false, retentionDays 90, crossSessionMemory false
  - [x] Source: types.ts:1169-1179

- [x] Task 10: Write navigation and next steps (AC: #10, #11, #13)
  - [x] Link to Sessions (../sessions/) — Story 62-7
  - [x] Link to Reactions (../reactions-engine/) — Story 62-10
  - [x] Link to Configuration (../../getting-started/configuration/) — Story 62-5
  - [x] Front matter verified: title, nav_order, parent, description

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Not applicable** — This story modifies a single Jekyll markdown page. No TypeScript interfaces.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Design Decisions

- **3-tier memory, not 2**: The epic says "3-tier memory architecture" and the source confirms 3 distinct tiers: ephemeral (in-context, no persistence), session-persistent (`.omc/project-memory.json`), and cross-session (`.omc/cross-session-memory.jsonl`). All 3 must be documented.
- **Pipeline A vs Pipeline B naming**: Pipeline A is Structured Learnings (session-learning.ts + learning-store.ts), Pipeline B is Cross-Session Knowledge (memory-bridge.ts). These are distinct systems with different storage and injection mechanisms.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.
- **Front matter title vs H1**: Must match. Previous stories (62-9, 62-10) verified this. Both should be "Memory & Learning".
- **SessionLearning has 13 fields, not 11**: Count the fields in types.ts:1954-1981 precisely: sessionId, agentId, storyId, projectId, outcome, durationMs, retryCount, filesModified, testsAdded, errorCategories, domainTags, completedAt, capturedAt = 13 fields. Verify count against source before writing.

### Previous Story Learnings (62-7 through 62-10)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide — verified with awk after every edit
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest
- Code review caught: unexplained items in lists, diagram abbreviation footnotes, step count accuracy, opaque terminology — verify these categories for this story too
- Count enum values, step counts, field counts precisely against source code — these are the #1 source of High/Medium severity review findings
- Diagram abbreviations need footnotes explaining what they represent
- **Title consistency**: Front matter `title` must match H1 heading. Caught in 62-9 review.
- **Type accuracy**: ReactionConfig review caught `string` vs union type — use precise TypeScript types in tables, not loose `string` approximations.

### Source Files for Memory & Learning Content

- **packages/core/src/session-learning.ts** (173 lines) — Session outcome capture: captureSessionLearning() (lines 79-137), inferDomainTags() (lines 25-41), selectRelevantLearnings() (lines 149-172), countTestFiles(), getModifiedFiles()
- **packages/core/src/learning-store.ts** (205 lines) — JSONL storage: LearningStore interface (lines 48-59), LearningStoreConfig (lines 24-31), LearningQuery (lines 34-45), file rotation (lines 175-196), retention cleanup (lines 167-173), createLearningStore() (line 202)
- **packages/core/src/memory-bridge.ts** (423 lines) — Cross-session knowledge: computeContentHash() (lines 35-37), extractMemoryFromWorkspace() (lines 49-58), deduplicateEntries() (lines 70-118), appendEntries() (lines 131-157), loadAccumulatedMemory() (lines 171-228), extractAndBridgeMemory() (lines 358-384), buildCrossSessionMemoryLayer() (lines 392-422)
- **packages/core/src/project-memory.ts** (101 lines) — Project memory persistence: emptyProjectMemory() (lines 17-19), readProjectMemory() (lines 35-69), writeProjectMemory() (lines 83-100)
- **packages/core/src/learning-patterns.ts** (105 lines) — Failure pattern detection: FailurePattern interface (lines 11-22), MIN_PATTERN_THRESHOLD=3 (line 25), suggestAction() (lines 28-45), detectPatterns() (lines 56-104)
- **packages/core/src/prompt-builder.ts** (239 lines) — 5-layer prompt: buildPrompt() (line 162), PromptBuildConfig (lines 46-70), buildConfigLayer() (lines 76-123), buildLearningsLayer() (lines 211-238)
- **packages/core/src/hooks.ts** lines 189-236 — projectMemoryPreCompact hook, registered at line 249
- **packages/core/src/types.ts** — SessionLearning (lines 1954-1981), CompletionEvent (lines 1932-1938), FailureEvent (lines 1940-1949), ProjectMemoryEntryType (line 3659), ProjectMemoryEntry (lines 3662-3668), ProjectMemory (lines 3671-3673), CrossSessionMemoryEntry (lines 3679-3689), learning config (lines 1169-1179)
- **packages/core/src/session-manager.ts** lines 599-627 — Spawn-time learning/memory injection
- **packages/core/src/completion-handlers.ts** lines 586-604 — Post-completion memory bridge extraction
- **packages/core/src/provider-verify.ts** lines 63-83 — .omc/project-memory.json verification
- **packages/cli/src/commands/learning-patterns.ts** (79 lines) — `ao learning-patterns` CLI command
- **packages/cli/src/commands/agent-history.ts** (136 lines) — `ao agent-history` CLI command
- **docs/architecture.md** — Memory & Learning section (if exists)

### Key Memory & Learning Facts (verified against source)

**3 memory tiers:** ephemeral (in-context only, no persistence), session-persistent (`.omc/project-memory.json`), cross-session (`.omc/cross-session-memory.jsonl`)

**Pipeline A — Structured Learnings:**
- SessionLearning: 13 fields (sessionId, agentId, storyId, projectId, outcome, durationMs, retryCount, filesModified, testsAdded, errorCategories, domainTags, completedAt, capturedAt) — types.ts:1954-1981
- 4 outcome values: completed, failed, blocked, abandoned — types.ts:1958
- 5 domain tag categories: frontend, testing, api, styling, backend — session-learning.ts:25-41
- LearningStore methods: store(), list(), query(), start(), stop() — learning-store.ts:48-59
- LearningQuery params: agentId, domain, outcome, sinceMs, limit — learning-store.ts:34-45
- Storage path: `{sessionsDir}/learnings.jsonl` — learning-store.ts:105
- Default max file size: 10MB — learning-store.ts (configurable)
- Default retention: 90 days — learning-store.ts (configurable)
- selectRelevantLearnings: filters to failed outcomes, prefers domain matches, default limit 3 — session-learning.ts:149-172

**Pipeline B — Cross-Session Knowledge:**
- CrossSessionMemoryEntry: extends ProjectMemoryEntry + 4 fields (contentHash, sourceSessionIds, firstSeenAt, lastSeenAt) — types.ts:3679-3689
- 4 entry types: convention, decision, directive, learning — types.ts:3659
- Content hash: MD5(type + ":" + content) — memory-bridge.ts:35-37
- Dedup: at load time, not write time, to prevent TOCTOU — memory-bridge.ts:70-118
- Storage: append-only JSONL to `.omc/cross-session-memory.jsonl` — memory-bridge.ts:131-157
- Rotation: 10MB, date-stamped rename — memory-bridge.ts:175-196
- Write lock: per-project lock manager for rewrite operations — memory-bridge.ts:239-256
- Non-fatal: never breaks completion or spawn — memory-bridge.ts:1-14

**5 prompt layers:**
1. Base Agent Prompt (constant) — prompt-builder.ts:22-40
2. Config-derived context — prompt-builder.ts:76-123
3. User Rules — prompt-builder.ts:129-149
4. Past Session Learnings (Pipeline A) — prompt-builder.ts:211-238
5. Cross-Session Knowledge (Pipeline B) — prompt-builder.ts:194-196

**Compaction survival:**
- projectMemoryPreCompact hook: hooks.ts:189-236, registered at line 249
- Reads `.omc/project-memory.json`, merges session metadata learnings, first-write-wins, atomic write
- Provider verify: checks file exists and is valid JSON — provider-verify.ts:63-83

**Failure pattern detection:**
- FailurePattern: 5 fields (category, occurrenceCount, affectedStories, lastOccurrence, suggestedAction) — learning-patterns.ts:11-22
- MIN_PATTERN_THRESHOLD = 3 — learning-patterns.ts:25
- 6 suggestAction categories: network, parse, auth, disk, exit_code, default — learning-patterns.ts:28-45

**Learning config (types.ts:1169-1179):**
- injectInPrompts?: boolean (default: false)
- injectFindings?: boolean (default: false)
- retentionDays?: number (default: 90)
- crossSessionMemory?: boolean (default: false)

**CLI commands:**
- `ao learning-patterns` — options: --json — learning-patterns.ts
- `ao agent-history <agent-id>` — options: --since, --limit, --json — agent-history.ts

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for type fields, prompt layers, CLI commands
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for config examples
- `bash` syntax highlighting for CLI commands
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../sessions/` → `docs/core-concepts/sessions.md` (exists, updated in Story 62-7)
- `../reactions-engine/` → `docs/core-concepts/reactions-engine.md` (exists, updated in Story 62-10)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/memory-learning.md`.

### References

- [Source: packages/core/src/session-learning.ts — captureSessionLearning, inferDomainTags, selectRelevantLearnings]
- [Source: packages/core/src/learning-store.ts — LearningStore interface, JSONL storage, rotation, retention]
- [Source: packages/core/src/memory-bridge.ts — cross-session extraction, dedup, rotation, prompt layer]
- [Source: packages/core/src/project-memory.ts — project memory read/write, emptyProjectMemory]
- [Source: packages/core/src/learning-patterns.ts — FailurePattern, detectPatterns, suggestAction]
- [Source: packages/core/src/prompt-builder.ts — 5-layer prompt, buildLearningsLayer]
- [Source: packages/core/src/hooks.ts — projectMemoryPreCompact hook]
- [Source: packages/core/src/types.ts — SessionLearning, CrossSessionMemoryEntry, learning config]
- [Source: packages/core/src/session-manager.ts — spawn-time learning injection]
- [Source: packages/core/src/completion-handlers.ts — post-completion memory bridge]
- [Source: packages/cli/src/commands/learning-patterns.ts — ao learning-patterns]
- [Source: packages/cli/src/commands/agent-history.ts — ao agent-history]
- [Source: Story 62-10 — Previous story learnings (type accuracy in tables, diagram widths)]
- [Source: Story 62-9 — Previous story learnings (title consistency, source accuracy)]
- [Source: Story 62-7 — Previous story learnings (diagram width, callouts, source accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 14 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars display width (max: 55 chars, measured with `wc -m`)
- 3 memory tiers documented: ephemeral, session-persistent, cross-session
- Pipeline A: SessionLearning with 13 fields documented from types.ts:1954-1981
- Pipeline B: CrossSessionMemoryEntry with 4 dedup fields documented from types.ts:3679-3689
- 4 entry types documented: convention, decision, directive, learning (types.ts:3659)
- 5 prompt layers documented with ASCII diagram (prompt-builder.ts:162-196, 211-238)
- Compaction survival documented with projectMemoryPreCompact hook (hooks.ts:189-236)
- Failure pattern detection with MIN_PATTERN_THRESHOLD=3 and 6 action categories (learning-patterns.ts:11-104)
- 2 CLI commands documented: ao learning-patterns, ao agent-history
- Configuration section with 4 settings (types.ts:1169-1179)
- No hero-style font classes used on interior page
- Front matter title matches H1 heading (both "Memory & Learning")
- 3 navigation links verified against existing sibling pages
- `pnpm test` passes (only pre-existing standup-generator date sensitivity failure unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-22 | Created story artifact from epic and source analysis | Claude Sonnet 4 |
| 2026-04-22 | Rewrote memory-learning.md from placeholder to full production page | Claude Sonnet 4 |
| 2026-04-22 | Fixed architecture box diagram width (narrowed from 42 to 37 char borders for mobile) | Claude Sonnet 4 |
| 2026-04-22 | Fixed prompt injection diagram width (shortened descriptions to stay under 60 chars) | Claude Sonnet 4 |
| 2026-04-22 | Code review: fixed 2M + 2L issues (capture flow outcomes, Layer 4 filter accuracy, rotation filename format, suggestAction precision) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4 on 2026-04-22
**Outcome:** Approved (with fixes applied)

**Findings (all fixed):**
- [M1] Capture flow diagram showed `completed/failed/blocked` — changed to `completed/failed/abandoned` since `captureSessionLearning()` never assigns "blocked" (verified: session-learning.ts:79-137)
- [M2] Layer 4 description said "failed and blocked" — changed to "failed" only since `selectRelevantLearnings()` filters to `outcome === "failed"` (session-learning.ts:155), and `captureSessionLearning()` never produces "blocked"
- [L1] Rotation filename example omitted time portion — changed from `cross-session-memory-2026-04-22.jsonl` to `cross-session-memory-2026-04-22T14-30-00.jsonl` to match actual format (memory-bridge.ts:147)
- [L2] Suggested Action descriptions were paraphrased — updated to match exact `suggestAction()` return strings (learning-patterns.ts:28-45)

**Source Verification:**
- SessionLearning 13 fields verified against types.ts:1954-1981 ✓
- 4 outcome values verified against types.ts:1964 ✓
- LearningStore 5 methods verified against learning-store.ts:48-59 ✓
- LearningQuery 5 params verified against learning-store.ts:34-45 ✓
- 5 domain tags verified against session-learning.ts:25-41 ✓
- CrossSessionMemoryEntry 4 extra fields verified against types.ts:3680-3689 ✓
- 4 entry types verified against types.ts:3659 ✓
- Content hash MD5(type:content) verified against memory-bridge.ts:35-36 ✓
- Load-time dedup verified against memory-bridge.ts:127-128, 197-222 ✓
- 10MB rotation verified against memory-bridge.ts:28, 141-148 ✓
- 5 prompt layers verified against prompt-builder.ts:162-196 ✓
- selectRelevantLearnings limit=3 verified against session-learning.ts:152 ✓
- MIN_PATTERN_THRESHOLD=3 verified against learning-patterns.ts:25 ✓
- 6 suggestAction categories verified against learning-patterns.ts:28-45 ✓
- FailurePattern 5 fields verified against learning-patterns.ts:11-22 ✓
- Config 4 settings verified against types.ts:1169-1179 ✓
- projectMemoryPreCompact hook verified against hooks.ts:189-236 ✓
- CLI --json option verified against learning-patterns.ts:17 ✓
- CLI --since/--limit/--json verified against agent-history.ts:48-50 ✓
- ASCII diagrams all ≤55 chars verified ✓

### File List

- `docs/core-concepts/memory-learning.md` — rewritten from placeholder to full production page (~333 lines)
