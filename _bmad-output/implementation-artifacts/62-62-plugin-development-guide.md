# Story 62.62: Plugin Development Guide

Status: done

## Story

As a developer building a plugin for the Agent Orchestrator,
I want a comprehensive plugin development guide that covers the PluginModule<T> pattern, all 8 plugin interfaces, directory structure, testing, and publication,
so that I can build and publish my own plugin correctly.

## Acceptance Criteria

1. **Plugin Development page** (`docs/contributing/plugin-development.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Plugin Development`, `nav_order: 2`, `parent: Contributing`, `description` field
2. **Plugin System Overview section** explains the 8 plugin slots, PluginSlot type, PluginManifest interface, PluginModule<T> interface, and the `satisfies` pattern
3. **Quick Start section** shows a minimal working plugin (Notifier — simplest interface with 2 required methods) with complete code, directory structure, and config wiring
4. **Plugin Interfaces Reference section** documents all 8 interfaces with required/optional method tables: Runtime (6+4), Agent (8+4), Workspace (4+3), Tracker (6+10), SCM (12+1), Notifier (2+2), Terminal (3+1), Provider (6+0) — methods with signatures from types.ts
5. **Directory Structure section** documents the canonical plugin layout: src/index.ts, package.json (with exports), tsconfig.json, vitest.config.ts — with explanation of each file
6. **Configuration section** documents how plugins are configured in agent-orchestrator.yaml (per-slot config, per-project overrides) with example YAML
7. **Testing section** documents plugin testing patterns: unit tests with mocks, integration test aliases, test file structure — with code examples
8. **Security section** documents plugin security requirements: execFile not exec, input validation, timeout requirements, no secret logging
9. **Publishing section** documents npm publication workflow: package.json requirements, changeset process, naming convention (@composio/ao-plugin-{slot}-{name})
10. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
11. **Cross-links** verified: parent Contributing, siblings (Development Guide, Testing Guide), Architecture Overview, SDK Reference, Plugin Index
12. **Callouts** use Just the Docs callout syntax (`{: .highlight }`, `{: .note}`, `{: .warning }`)
13. **All interfaces and methods match** `packages/core/src/types.ts` — no fabricated APIs

## Tasks / Subtasks

- [x] Task 1: Write Plugin Development Guide (AC: #1-13)
  - [x] Replace stub content in docs/contributing/plugin-development.md
  - [x] Write front matter (title, nav_order: 2, parent: Contributing, description) (AC #1)
  - [x] Write "Plugin System Overview" section — 8 slots, PluginManifest, PluginModule, satisfies (AC #2)
  - [x] Write "Quick Start" section — minimal Notifier plugin (AC #3)
  - [x] Write "Plugin Interfaces Reference" section — all 8 interfaces with method tables (AC #4)
  - [x] Write "Directory Structure" section — canonical layout (AC #5)
  - [x] Write "Configuration" section — YAML config, per-project overrides (AC #6)
  - [x] Write "Testing" section — unit/integration patterns (AC #7)
  - [x] Write "Security" section — execFile, validation, timeouts (AC #8)
  - [x] Write "Publishing" section — npm, changesets, naming (AC #9)
  - [x] Verify no hero font classes (AC #10)
  - [x] Verify cross-links resolve (AC #11)
  - [x] Verify callouts use Just the Docs syntax (AC #12)
  - [x] Verify all interfaces/methods match types.ts (AC #13)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/contributing/plugin-development.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All interface methods verified against packages/core/src/types.ts
- Cross-links resolve to existing pages
- No hero font classes used

## Dev Notes

### Architecture Patterns (from Story 62-48 through 62-61 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- This is a **plugin development guide** — detailed authoring walkthrough for plugin builders
- Use Just the Docs callout syntax: `{: .highlight }`, `{: .note }`, `{: .warning }`
- Current stub references "Story 62.25" — incorrect, this is Story 62-62

### Source Tree — Plugin Interface Definitions

From `packages/core/src/types.ts`:

**PluginSlot** (line 1559): `"runtime" | "agent" | "workspace" | "tracker" | "scm" | "notifier" | "terminal" | "provider"`

**PluginManifest** (line 1570): `{ name: string; slot: PluginSlot; description: string; version: string; }`

**PluginModule<T>** (line 1594): `{ manifest: PluginManifest; create(config?: Record<string, unknown>): T; init?(): Promise<void> | void; shutdown?(): Promise<void> | void; }`

### Source Tree — Plugin Interfaces Summary

| Interface | Line | Required | Optional | Total |
|-----------|------|----------|----------|-------|
| Runtime | 225 | 6 (name, create, destroy, sendMessage, getOutput, isAlive) | 4 (getMetrics, getAttachInfo, getExitCode, getSignal) | 10 |
| Agent | 302 | 8 (name, processName, getLaunchCommand, getEnvironment, detectActivity, getActivityState, isProcessRunning, getSessionInfo) | 4 (promptDelivery, getRestoreCommand, postLaunchSetup, setupWorkspaceHooks) | 12 |
| Workspace | 428 | 4 (name, create, destroy, list) | 3 (postCreate, exists, restore) | 7 |
| Tracker | 471 | 6 (name, getIssue, isCompleted, issueUrl, branchName, generatePrompt) | 10 (issueLabel, listIssues, updateIssue, createIssue, validateIssue, findIssueByBranch, onPRMerge, onSessionDeath, getNotifications, getEpicTitle) | 16 |
| SCM | 567 | 12 (name, detectPR, getPRState, mergePR, closePR, getCIChecks, getCISummary, getReviews, getReviewDecision, getPendingComments, getAutomatedComments, getMergeability) | 1 (getPRSummary) | 13 |
| Notifier | 718 | 2 (name, notify) | 2 (notifyWithActions, post) | 4 |
| Terminal | 752 | 3 (name, openSession, openAll) | 1 (isSessionOpen) | 4 |
| SessionEnhancementProvider | 1515 | 6 (name, install, configure, enhance, teardown, healthCheck) | 0 | 6 |

### Source Tree — Example Plugin (notifier-desktop)

From `packages/plugins/notifier-desktop/src/index.ts`:
- Demonstrates PluginModule<Notifier> pattern
- Uses `export default { manifest, create } satisfies PluginModule<Notifier>;`
- Config passed to create() as `Record<string, unknown>`
- Shows good patterns: execFile for shell commands, input validation, platform detection

### Source Tree — Example Plugin (runtime-tmux)

From `packages/plugins/runtime-tmux/src/index.ts`:
- Demonstrates PluginModule<Runtime> pattern
- Input validation: SAFE_SESSION_ID regex for session IDs
- Security: execFileAsync (promisified execFile) for all tmux commands
- Long command handling: tmp file + load-buffer + paste-buffer for >200 char commands

### Source Tree — Related Docs

| File | Purpose |
|------|---------|
| `docs/contributing/index.md` | Contributing Guide parent page (done) |
| `docs/contributing/development.md` | Development Guide sibling (done) |
| `docs/contributing/testing.md` | Testing Guide sibling (backlog — Story 62-63) |
| `docs/plugins/index.md` | Plugin Index (done) |
| `docs/getting-started/architecture-overview.md` | Architecture reference (done) |
| `docs/sdk/index.md` | SDK Reference (done) |

### Project Structure Notes

- Doc file location: `docs/contributing/plugin-development.md`
- Nav order: 2 (second child under Contributing)
- Parent: Contributing (`docs/contributing/index.md`)
- Siblings: development.md (nav_order: 1), testing.md (nav_order: 3)
- Current stub references "Story 62.25" — incorrect, this is Story 62-62

### References

- [Source: packages/core/src/types.ts — all 8 plugin interfaces, PluginSlot, PluginManifest, PluginModule]
- [Source: packages/plugins/notifier-desktop/src/index.ts — complete Notifier plugin example]
- [Source: packages/plugins/runtime-tmux/src/index.ts — complete Runtime plugin example]
- [Source: CLAUDE.md — plugin pattern, security rules, ESM conventions]

## Change Log

- 2026-04-28: Story created from sprint backlog
- 2026-04-28: Replaced 6-line stub with comprehensive plugin development guide (all 8 interfaces documented, quick start notifier, directory structure, config, testing, security, publishing)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/contributing/plugin-development.md` stub (6 lines) with comprehensive plugin development guide
- All 13 acceptance criteria covered across 9 sections
- Sections: Plugin System Overview (PluginSlot, PluginManifest, PluginModule<T> types with code), Quick Start (complete Notifier plugin with manifest, create, satisfies, config), Plugin Interfaces Reference (all 8 interfaces with required/optional method tables — verified against types.ts), Directory Structure (canonical layout with package.json, tsconfig.json examples), Configuration (YAML per-slot and per-project config with code), Testing (unit tests with mocks, integration test aliases), Security (execFile rules, input validation, no secret logging), Publishing (naming convention, changeset workflow), Real-World Example (notifier-desktop reference)
- Front matter includes `description` field and `parent: Contributing` (was missing from stub)
- 6 cross-links verified: Contributing, Development Guide, Testing Guide, Architecture Overview, SDK, Plugin Index
- No hero font classes used
- All code blocks use correct syntax highlighting (typescript, yaml, text, json, bash)
- 7 Just the Docs callouts (highlight ×1, note ×3, warning ×3)
- All interface methods and signatures verified against packages/core/src/types.ts
- No fabricated APIs — all method names and parameter types match types.ts exactly

### File List

- `docs/contributing/plugin-development.md` — replaced stub with comprehensive Plugin Development Guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-28

### Review Findings

**Issues Found:** 0 HIGH, 0 MEDIUM, 0 LOW = 0 total

### Verification Summary

- All 13 ACs verified implemented
- 6 cross-links verified resolving to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting (typescript ×9, yaml ×3, text ×2, json ×2, bash ×1)
- 7 Just the Docs callouts
- All 8 interface method tables verified against `packages/core/src/types.ts`:
  - Runtime: 6 required + 4 optional = 10 methods (matches lines 225+)
  - Agent: 8 required + 4 optional = 12 methods (matches lines 302+)
  - Workspace: 4 required + 3 optional = 7 methods (matches lines 428+)
  - Tracker: 6 required + 10 optional = 16 methods (matches lines 471+)
  - SCM: 12 required + 1 optional = 13 methods (matches lines 567+)
  - Notifier: 2 required + 2 optional = 4 methods (matches lines 718+)
  - Terminal: 3 required + 1 optional = 4 methods (matches lines 752+)
  - Provider: 6 required + 0 optional = 6 methods (matches lines 1515+)
- PluginManifest fields match types.ts line 1570
- PluginModule<T> fields match types.ts line 1594
- PluginSlot values match types.ts line 1559
- Quick Start Notifier plugin code is correct and would compile
- Security section matches CLAUDE.md conventions (execFile, timeouts, no interpolation)
- No fabricated APIs or methods

### Outcome

**APPROVED** — No issues found. Plugin development guide accurately documents all interfaces and patterns.
