# Story 62.52: Prompt Layers

Status: done

## Story

As a developer working with the Agent Orchestrator,
I want a comprehensive Prompt Layers guide that documents the 5-layer prompt composition system, the CLAUDE.md merge strategy, config gating, template format, and custom layer injection with practical code examples,
so that I can understand, configure, and extend the prompt assembly pipeline to control what context agents receive at spawn time.

## Acceptance Criteria

1. **Prompt Layers page** (`docs/advanced/prompt-layers.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Prompt Layers`, `nav_order: 5`, `parent: Advanced Topics`, `description` field
2. **Overview section** introduces the prompt composition system — 5-layer model, parallel CLAUDE.md merge, two delivery mechanisms (injected prompt vs CLAUDE.md), relationship to sessions and providers — links to Sessions, Custom Plugin Development docs
3. **Layer Architecture section** documents: the 5 layers (base → config → rules → learnings → memory) + user override final layer, the `buildPrompt()` function, `PromptBuildConfig` interface, layer ordering and precedence — sourced from `packages/core/src/prompt-builder.ts`
4. **Layer 1 (Base) section** documents: `BASE_AGENT_PROMPT` constant, content (session lifecycle, git workflow, PR best practices), always-included behavior, source from `packages/core/src/prompt-builder.ts:22-40`
5. **Layer 2 (Config Context) section** documents: `buildConfigLayer()` function, headings produced (Project Context, Task, Issue Details, Story Context, Automated Reactions), config fields consumed, source from `packages/core/src/prompt-builder.ts:76-123`
6. **Layer 3 (User Rules) section** documents: `readUserRules()` function, `project.agentRules` and `project.agentRulesFile` config fields, heading `## Project Rules`, file reading behavior, source from `packages/core/src/prompt-builder.ts:129-149`
7. **Layer 4 (Learnings) section** documents: `buildLearningsLayer()` function, `selectRelevantLearnings()` filtering (failed outcomes, domain matches, recency, limit 3), `SessionLearning` type key fields, config gate `project.learning.injectInPrompts`, source from `packages/core/src/prompt-builder.ts:211-238` and `packages/core/src/session-learning.ts`
8. **Layer 5 (Cross-Session Memory) section** documents: `buildCrossSessionMemoryLayer()` function, content-hash dedup, JSONL append-only storage, 10MB rotation, config gate `project.learning.crossSessionMemory`, source from `packages/core/src/memory-bridge.ts`
9. **CLAUDE.md Merge section** documents: `mergeClaudeMd()`, merge format (project content → separator → provider header → additions), idempotent re-merge, `performMerge()` integration, source from `packages/core/src/claudemd-merge.ts`
10. **Delivery Mechanisms section** documents the two paths: composed prompt via runtime `sendMessage()` vs CLAUDE.md file read natively by agent, when each is used, how they interact
11. **Configuration section** documents: all config fields that control prompt layers (`agentRules`, `agentRulesFile`, `learning.injectInPrompts`, `learning.crossSessionMemory`, `sessionEnhancement`), per-project overrides in `agent-orchestrator.yaml`
12. **Config Examples section** provides practical examples: (a) basic prompt layer config, (b) custom rules file, (c) full learning + memory config, (d) per-project override
13. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
14. **Cross-links** verified: parent link to Advanced Topics, sibling links to other advanced pages, links to Sessions, Memory & Learning, Configuration
15. **Front matter** includes `description` field

## Tasks / Subtasks

- [x] Task 1: Write Prompt Layers page (AC: #1-15)
  - [x] Replace stub content in docs/advanced/prompt-layers.md
  - [x] Write front matter (title, nav_order: 5, parent: Advanced Topics, description) (AC #1, #15)
  - [x] Write "Overview" section — 5-layer model, two delivery paths, links (AC #2)
  - [x] Write "Layer Architecture" section — buildPrompt(), PromptBuildConfig, layer table (AC #3)
  - [x] Write "Layer 1: Base Agent Prompt" section — BASE_AGENT_PROMPT constant, content (AC #4)
  - [x] Write "Layer 2: Config Context" section — buildConfigLayer(), headings, fields (AC #5)
  - [x] Write "Layer 3: User Rules" section — readUserRules(), agentRules, agentRulesFile (AC #6)
  - [x] Write "Layer 4: Session Learnings" section — buildLearningsLayer(), selectRelevantLearnings(), config gate (AC #7)
  - [x] Write "Layer 5: Cross-Session Memory" section — buildCrossSessionMemoryLayer(), dedup, rotation (AC #8)
  - [x] Write "CLAUDE.md Merge" section — mergeClaudeMd(), format, idempotent, performMerge() (AC #9)
  - [x] Write "Delivery Mechanisms" section — sendMessage vs CLAUDE.md, when each used (AC #10)
  - [x] Write "Configuration" section — all config fields, per-project overrides (AC #11)
  - [x] Write "Config Examples" section — 4 practical examples (AC #12)
  - [x] Write cross-links section (AC #14)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #13)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/advanced/prompt-layers.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- Layer function names match source code
- Config field names match source code
- PromptBuildConfig fields match source code

## Dev Notes

### Architecture Patterns (from Story 62-48, 62-49, 62-50, 62-51 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Advanced Topics index, sibling links to each advanced sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Function names and config field names must match actual TypeScript source
- This is an **advanced guide page** (not an API reference page), so it should focus on concepts, walkthroughs, and practical examples with links to existing docs
- From 62-51 review: verify all emission/behavior claims against actual source code; do not assume modules emit events just because types exist
- From 62-51 review: JSON/YAML examples must include all structural fields from actual source

### Source Tree — Prompt Builder (1 file)

| Module | Purpose | Source |
|--------|---------|--------|
| `prompt-builder.ts` | buildPrompt(), BASE_AGENT_PROMPT, buildConfigLayer(), readUserRules(), buildLearningsLayer(), selectRelevantLearnives(), PromptBuildConfig | `packages/core/src/prompt-builder.ts` |

### Source Tree — Supporting Modules (3 files)

| Module | Purpose | Source |
|--------|---------|--------|
| `claudemd-merge.ts` | mergeClaudeMd(), readClaudeMd(), writeClaudeMd(), performMerge() | `packages/core/src/claudemd-merge.ts` |
| `session-learning.ts` | captureSessionLearning(), selectRelevantLearnings() | `packages/core/src/session-learning.ts` |
| `memory-bridge.ts` | buildCrossSessionMemoryLayer(), content-hash dedup, JSONL storage | `packages/core/src/memory-bridge.ts` |

### Source Tree — Session Manager Integration (1 file)

| Module | Purpose | Source |
|--------|---------|--------|
| `session-manager.ts` | Spawn flow: assembles all layers, calls buildPrompt(), performs CLAUDE.md merge | `packages/core/src/session-manager.ts` |

### Source Tree — Type Definitions (1 file)

| Module | Purpose | Source |
|--------|---------|--------|
| `types.ts` | SessionLearning, CrossSessionMemoryEntry, ClaudeMdMergeResult, SessionEnhancementConfig, ProjectConfig learning fields | `packages/core/src/types.ts` |

### Source Tree — Story References (2 files)

| File | Purpose | Source |
|------|---------|--------|
| `12-1-prompt-learning-injection.md` | Implementation spec for learnings layer (Layer 4) | `_bmad-output/implementation-artifacts/` |
| `59-4-claudemd-merge-strategy.md` | Implementation spec for CLAUDE.md merge strategy | `_bmad-output/implementation-artifacts/` |

### Key Types

| Type | Fields/Purpose | Source |
|------|----------------|--------|
| `PromptBuildConfig` | project, projectId, issueId, issueContext, storyContext, userPrompt, learnings, crossSessionMemory | `packages/core/src/prompt-builder.ts:46` |
| `SessionLearning` | sessionId, agentId, storyId, projectId, outcome, durationMs, retryCount, filesModified, testsAdded, errorCategories, domainTags, completedAt, capturedAt | `packages/core/src/types.ts:1954` |
| `CrossSessionMemoryEntry` | Extends ProjectMemoryEntry with contentHash, sourceSessionIds, firstSeenAt, lastSeenAt | `packages/core/src/types.ts:3680` |
| `ClaudeMdMergeResult` | merged (boolean), path (string) | `packages/core/src/types.ts:1498` |

### Key Functions

| Function | Signature | Source |
|----------|-----------|--------|
| `buildPrompt()` | `(config: PromptBuildConfig) => string` | `packages/core/src/prompt-builder.ts:162` |
| `buildConfigLayer()` | `(project, projectId, issueId, issueContext, storyContext) => string` | `packages/core/src/prompt-builder.ts:76` |
| `readUserRules()` | `(project) => string` | `packages/core/src/prompt-builder.ts:129` |
| `buildLearningsLayer()` | `(learnings: SessionLearning[]) => string` | `packages/core/src/prompt-builder.ts:211` |
| `selectRelevantLearnings()` | Filters failed outcomes, domain matches, recency, limit 3 | `packages/core/src/session-learning.ts:149` |
| `buildCrossSessionMemoryLayer()` | `(projectPath: string) => Promise<string>` | `packages/core/src/memory-bridge.ts:392` |
| `mergeClaudeMd()` | `(existingContent, providerAdditions, providerName) => string` | `packages/core/src/claudemd-merge.ts:94` |
| `performMerge()` | `(workspacePath, providerName) => Promise<ClaudeMdMergeResult>` | `packages/core/src/claudemd-merge.ts` |

### Key Config Fields (from types.ts + ProjectConfig)

| Field | Layer | Purpose | Default |
|-------|-------|---------|---------|
| `project.agentRules` | Layer 3 | Inline rules string | (none) |
| `project.agentRulesFile` | Layer 3 | Path to rules file | (none) |
| `project.learning.injectInPrompts` | Layer 4 | Enable learnings injection | false |
| `project.learning.crossSessionMemory` | Layer 5 | Enable cross-session memory | false |
| `project.sessionEnhancement` | CLAUDE.md | Provider config for CLAUDE.md merge | (none) |
| `project.orchestratorRules` | — | Orchestrator-specific rules | (none) |

### Layer Assembly Order (from buildPrompt())

```
Layer 1: BASE_AGENT_PROMPT (always, when any layer present)
Layer 2: buildConfigLayer() (always, when any layer present)
Layer 3: readUserRules() (if agentRules or agentRulesFile set)
Layer 4: buildLearningsLayer() (if learning.injectInPrompts enabled)
Layer 5: buildCrossSessionMemoryLayer() (if learning.crossSessionMemory enabled)
Final:  userPrompt (if --prompt argument provided)
```

### CLAUDE.md Merge Format

```
<original project CLAUDE.md content>
---
<!-- Provider: {providerName} -->
## Provider Enhancements ({providerName})
<provider additions content>
<!-- /Provider: {providerName} -->
```

### Delivery Mechanism Comparison

| Aspect | Composed Prompt | CLAUDE.md Merge |
|--------|----------------|-----------------|
| Delivered via | Runtime `sendMessage()` | File write to worktree |
| Read by | Agent at session start | Agent natively reads file |
| Content type | Structured system prompt | Markdown instructions |
| When applied | Every spawn | After `provider.configure()` |
| Failure mode | Non-blocking (warn) | Non-blocking (warn) |
| Idempotent | N/A (re-sent each time) | Yes (strips old provider section) |

### Testing Standards

- Verify layer function names match source (buildPrompt, buildConfigLayer, readUserRules, buildLearningsLayer, buildCrossSessionMemoryLayer)
- Verify config field names match types.ts (agentRules, agentRulesFile, learning.injectInPrompts, learning.crossSessionMemory)
- Verify cross-links resolve to existing pages
- Verify no hero font classes
- Verify YAML config examples match agent-orchestrator.yaml.example format
- Verify merge format matches claudemd-merge.ts output
- Verify selectRelevantLearnings filtering rules match source (failed outcomes, domain matches, recency, limit 3)

### Project Structure Notes

- Doc file location: `docs/advanced/prompt-layers.md`
- Nav order: 5 (fifth child under Advanced Topics, after hooks-extensions)
- Parent: Advanced Topics (`docs/advanced/index.md`)
- Sibling pages: cross-project (1), monte-carlo (2), custom-plugins (3), hooks-extensions (4), prompt-layers (5), production-deployment (6)
- Current stub says "Story 62.21" — incorrect, this is Story 62-52
- This is an **advanced guide** page (concepts + walkthrough + practical examples), NOT an API reference page

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.52]
- [Source: packages/core/src/prompt-builder.ts — buildPrompt(), BASE_AGENT_PROMPT, buildConfigLayer(), readUserRules(), buildLearningsLayer(), PromptBuildConfig]
- [Source: packages/core/src/claudemd-merge.ts — mergeClaudeMd(), readClaudeMd(), writeClaudeMd(), performMerge()]
- [Source: packages/core/src/session-learning.ts — captureSessionLearning(), selectRelevantLearnings()]
- [Source: packages/core/src/memory-bridge.ts — buildCrossSessionMemoryLayer()]
- [Source: packages/core/src/session-manager.ts — spawn flow assembly (lines 593-638, 732)]
- [Source: packages/core/src/types.ts — SessionLearning, CrossSessionMemoryEntry, ClaudeMdMergeResult, ProjectConfig learning fields]
- [Source: _bmad-output/implementation-artifacts/12-1-prompt-learning-injection.md — learnings layer spec]
- [Source: _bmad-output/implementation-artifacts/59-4-claudemd-merge-strategy.md — merge strategy spec]
- [Source: docs/advanced/hooks-extensions.md — sibling advanced guide for structural reference]

## Change Log

- 2026-04-27: Story created from sprint backlog
- 2026-04-27: Replaced 10-line stub in `docs/advanced/prompt-layers.md` with comprehensive Prompt Layers guide covering 5-layer composition, CLAUDE.md merge, delivery mechanisms, and 4 config examples

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/advanced/prompt-layers.md` stub (10 lines) with comprehensive documentation
- All 15 acceptance criteria covered across 13 sections
- Sections: Overview (5-layer model, two delivery paths), Layer Architecture (buildPrompt/PromptBuildConfig/layer table), Layer 1 Base Agent Prompt (BASE_AGENT_PROMPT), Layer 2 Config Context (buildConfigLayer/headings), Layer 3 User Rules (readUserRules/agentRules/agentRulesFile), Layer 4 Session Learnings (buildLearningsLayer/selectRelevantLearnings/config gate), Layer 5 Cross-Session Memory (buildCrossSessionMemoryLayer/dedup/rotation), CLAUDE.md Merge (mergeClaudeMd/performMerge/idempotent), Delivery Mechanisms (comparison table), Configuration (all config fields), Config Examples (4 examples)
- Front matter includes `description` field (was missing from stub)
- Cross-links verified: parent Advanced Topics, 5 sibling pages, Sessions, Memory & Learning, 3 getting-started pages (all 11 resolve)
- No hero font classes used
- All code blocks use correct syntax highlighting (typescript, yaml, markdown)
- Function names verified against source:
  - buildPrompt() at prompt-builder.ts:162
  - buildConfigLayer() at prompt-builder.ts:76
  - readUserRules() at prompt-builder.ts:129
  - buildLearningsLayer() at prompt-builder.ts:211
  - buildCrossSessionMemoryLayer() at memory-bridge.ts:392
  - mergeClaudeMd() at claudemd-merge.ts:94
  - performMerge() at claudemd-merge.ts:246
- Config field names verified: agentRules, agentRulesFile, learning.injectInPrompts, learning.crossSessionMemory
- 10MB rotation constant verified: DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 at memory-bridge.ts:28
- Provider name validation verified: PROVIDER_NAME_RE at claudemd-merge.ts:26
- selectRelevantLearnings filtering verified: failed outcomes, domain matching, recency, limit 3
- Distinguished two delivery mechanisms: composed prompt (sendMessage) vs CLAUDE.md merge (file write)
- Corrected stub reference from "Story 62.21" to Story 62-52

### File List

- `docs/advanced/prompt-layers.md` — replaced stub with comprehensive Prompt Layers guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-27

### Review Findings

**Issues Found:** 0 HIGH, 1 MEDIUM, 2 LOW = 3 total
**Issues Fixed:** 3

#### MEDIUM Issues

1. **Internal contradiction in Layer 4 filtering description**: The doc described `buildLearningsLayer()` as filtering with `outcome !== "completed"` and `selectRelevantLearnings()` as filtering with `outcome === "failed"` without clarifying these are two separate filter stages with different semantics. `selectRelevantLearnings()` is strict (failed only) while `buildLearningsLayer()` is broad (excludes only completed). In practice the pre-filter runs first, but if `buildLearningsLayer()` were called directly it would include "abandoned" and "blocked" outcomes. **Fixed** — added "Two-Stage Filtering Pipeline" section with a visual diagram and comparison table showing both stages, their filters, and the safety-net relationship.

#### LOW Issues

2. **BASE_AGENT_PROMPT text had continuation wraps**: The doc rendered the constant text with line wraps (continuation indentation) that didn't match the actual single-line format in the source. **Fixed** — replaced with unwrapped text matching actual source, added `...` ellipsis for omitted sections.

3. **Provider additions path was hardcoded as `.omc/`**: The doc said `.omc/provider-claude-md.md` but the actual code constructs `.{providerName}/provider-claude-md.md` — the directory name is dynamic based on the provider. Correct for the default "omc" provider but misleading about the mechanism. **Fixed** — changed to `.{providerName}/provider-claude-md.md` with parenthetical note showing the OMC default.

### Verification Summary

- All 15 ACs verified implemented
- All 11 cross-links resolve to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting
- Function names and line numbers verified against source (7 functions checked)
- Config field names verified against types.ts
- Two-stage filtering pipeline now accurately documented
- Provider additions path now shows dynamic provider name

### Outcome

**APPROVED** — All 3 issues fixed. Documentation accurately reflects source code, filtering pipeline semantics are now clearly distinguished.
