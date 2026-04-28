# Story 62.50: Custom Plugin Development

Status: done

## Story

As a developer extending the Agent Orchestrator,
I want a comprehensive Custom Plugin Development guide that documents the PluginModule interface, directory structure, registration, testing, plugin lifecycle, and all 8 plugin slots with practical code examples,
so that I can author, test, and distribute custom plugins for the orchestration system.

## Acceptance Criteria

1. **Custom Plugin Development page** (`docs/advanced/custom-plugins.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Custom Plugin Development`, `nav_order: 3`, `parent: Advanced Topics`, `description` field
2. **Overview section** introduces the plugin system — 8 plugin slots, PluginModule interface, manifest + create() pattern, agent-agnostic architecture — links to Plugins Index
3. **Plugin Architecture section** documents: PluginSlot (8 values: runtime, agent, workspace, tracker, scm, notifier, terminal, provider), PluginManifest (4 fields: name, slot, description, version), PluginModule<T> generic interface, PluginLifecycle — sourced from `packages/core/src/types.ts`
4. **Plugin Structure section** documents: directory layout (`src/index.ts`, `package.json`, `tsconfig.json`), export pattern (manifest + create() + default export with `satisfies PluginModule<T>`), naming conventions — sourced from CLAUDE.md conventions and existing plugins
5. **Slot Interfaces section** documents all 8 slot interfaces with method signatures: Runtime (7 methods), Agent (10 methods), Workspace (5 methods), Tracker (7 methods), SCM (6 methods), Notifier (5 methods), Terminal (4 methods), SessionEnhancementProvider (4 methods) — sourced from `packages/core/src/types.ts`
6. **Step-by-Step Guide section** provides a complete walkthrough for creating a new plugin from scratch: scaffold, implement interface, test, register, configure — using a concrete example (custom notifier)
7. **Plugin Registry section** documents: BUILTIN_PLUGINS map, register(), get(), list(), loadBuiltins(), loadFromConfig(), reload(), shutdown() — sourced from `packages/core/src/plugin-registry.ts`
8. **Plugin Loader section** documents: scan(), loadPlugin(), permission system, PermissionError, module resolution — sourced from `packages/core/src/plugin-loader.ts`
9. **Plugin Installer section** documents: install(), uninstall(), update(), search(), disable(), enable() — sourced from `packages/core/src/plugin-installer.ts`
10. **Version Compatibility section** documents: check(), CompatibilityResult, version matching rules — sourced from `packages/core/src/plugin-version-compatibility.ts`
11. **Testing section** documents: plugin testing patterns, mock interfaces, vitest configuration, test file conventions — sourced from existing plugin tests and CLAUDE.md conventions
12. **Configuration section** documents: per-project plugin overrides in `agent-orchestrator.yaml`, plugin discovery paths, config validation — sourced from `agent-orchestrator.yaml.example`
13. **Config Examples section** provides practical examples: (a) minimal runtime plugin, (b) custom notifier plugin, (c) plugin configuration in YAML
14. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
15. **Cross-links** verified: parent link to Advanced Topics, sibling links to other advanced pages, links to Plugins Index, Getting Started, Configuration
16. **Front matter** includes `description` field

## Tasks / Subtasks

- [x] Task 1: Write Custom Plugin Development page (AC: #1-16)
  - [x] Replace stub content in docs/advanced/custom-plugins.md
  - [x] Write front matter (title, nav_order: 3, parent: Advanced Topics, description) (AC #1, #16)
  - [x] Write "Overview" section — 8 slots, architecture, links to Plugins Index (AC #2)
  - [x] Write "Plugin Architecture" section — PluginSlot, PluginManifest, PluginModule<T>, PluginLifecycle (AC #3)
  - [x] Write "Plugin Structure" section — directory layout, export pattern, naming (AC #4)
  - [x] Write "Slot Interfaces" section — all 8 interfaces with method counts (AC #5)
  - [x] Write "Step-by-Step Guide" section — complete walkthrough with custom notifier example (AC #6)
  - [x] Write "Plugin Registry" section — registration, loading, lifecycle management (AC #7)
  - [x] Write "Plugin Loader" section — scanning, permissions, resolution (AC #8)
  - [x] Write "Plugin Installer" section — install/uninstall/update/search (AC #9)
  - [x] Write "Version Compatibility" section — check(), CompatibilityResult (AC #10)
  - [x] Write "Testing" section — patterns, mocks, vitest config (AC #11)
  - [x] Write "Configuration" section — YAML config, overrides, discovery (AC #12)
  - [x] Write "Config Examples" section — 3 practical examples (AC #13)
  - [x] Write cross-links section (AC #15)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #14)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/advanced/custom-plugins.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- Method counts per interface match source code
- Export pattern matches CLAUDE.md conventions

## Dev Notes

### Architecture Patterns (from Story 62-48, 62-49 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Advanced Topics index, sibling links to each advanced sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Method counts per interface must match actual TypeScript interfaces
- This is an **advanced guide page** (not an API reference page), so it should focus on concepts, walkthroughs, and practical examples with links to existing docs

### Source Tree — Core Types (1 file)

| Module | Purpose | Source |
|--------|---------|--------|
| `types.ts` | PluginSlot, PluginManifest, PluginModule<T>, PluginLifecycle, all 8 slot interfaces | `packages/core/src/types.ts` |

### Source Tree — Plugin Infrastructure (5 files)

| Module | Purpose | Source |
|--------|---------|--------|
| `plugin-registry.ts` | BUILTIN_PLUGINS, register(), get(), list(), loadBuiltins(), loadFromConfig(), reload(), shutdown() | `packages/core/src/plugin-registry.ts` |
| `plugin-loader.ts` | scan(), loadPlugin(), permission system, PermissionError | `packages/core/src/plugin-loader.ts` |
| `plugin-installer.ts` | install(), uninstall(), update(), search(), disable(), enable() | `packages/core/src/plugin-installer.ts` |
| `plugin-version-compatibility.ts` | check(), CompatibilityResult, version matching | `packages/core/src/plugin-version-compatibility.ts` |
| `plugin-npm-registry.ts` | search(), getDetails(), validate(), publish() | `packages/core/src/plugin-npm-registry.ts` |

### Source Tree — Example Plugins (3 files, complexity progression)

| Plugin | Complexity | Source |
|--------|-----------|--------|
| `runtime-process` | Simple (minimal runtime) | `packages/plugins/runtime-process/src/index.ts` |
| `notifier-webhook` | Simple (HTTP notifier) | `packages/plugins/notifier-webhook/src/index.ts` |
| `workspace-worktree` | Moderate (git worktree) | `packages/plugins/workspace-worktree/src/index.ts` |
| `scm-github` | Complex (full SCM) | `packages/plugins/scm-github/src/index.ts` |

### Source Tree — Config (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `agent-orchestrator.yaml.example` | Plugin config patterns, per-project overrides | `agent-orchestrator.yaml.example` |

### Key Types

| Type | Fields/Values | Source |
|------|--------------|--------|
| `PluginSlot` | 8 values: "runtime", "agent", "workspace", "tracker", "scm", "notifier", "terminal", "provider" | `packages/core/src/types.ts` |
| `PluginManifest` | 4 fields: name, slot, description, version | `packages/core/src/types.ts` |
| `PluginModule<T>` | 2 fields: manifest (PluginManifest), create() → T | `packages/core/src/types.ts` |
| `PluginLifecycle` | 3 methods: initialize(), shutdown(), healthCheck?() | `packages/core/src/types.ts` |
| `Runtime` | 7 methods: create, destroy, list, getOutput, sendInput, kill, getExitCode | `packages/core/src/types.ts` |
| `Agent` | 10 methods: spawn, terminate, getStatus, sendCommand, getSessionInfo, getHistory, setStoryContext, getCapabilities, healthCheck, configure | `packages/core/src/types.ts` |
| `Workspace` | 5 methods: create, destroy, getStatus, getDiff, resolvePath | `packages/core/src/types.ts` |
| `Tracker` | 7 methods: createProject, getProject, listStories, updateStory, getComments, addComment, createPullRequest | `packages/core/src/types.ts` |
| `SCM` | 6 methods: clone, createBranch, commit, push, createPR, getPRStatus | `packages/core/src/types.ts` |
| `Notifier` | 5 methods: send, configure, testConnection, getChannels, validateConfig | `packages/core/src/types.ts` |
| `Terminal` | 4 methods: open, close, sendKeys, getSessions | `packages/core/src/types.ts` |
| `SessionEnhancementProvider` | 4 methods: enhance, getCapabilities, validateConfig, healthCheck | `packages/core/src/types.ts` |

### Key Behavioral Patterns

- **PluginModule<T>**: Generic interface — manifest declares slot, create() returns slot-specific implementation
- **`satisfies` keyword**: Compile-time type checking for plugin exports — enforced by CLAUDE.md conventions
- **BUILTIN_PLUGINS**: Map of 8 default plugins (one per slot) — loaded at startup
- **Plugin discovery**: scan() searches node_modules for `ao-plugin-*` packages
- **Permission system**: Plugins declare required permissions, loader validates before loading
- **PermissionError**: Thrown when plugin exceeds its declared permissions
- **Registration**: register() adds plugin to registry, get() retrieves by name, list() returns all
- **Lifecycle**: initialize() → active → shutdown(), optional healthCheck()
- **Config loading**: loadFromConfig() reads plugin overrides from agent-orchestrator.yaml
- **Hot reload**: reload() replaces a running plugin without full restart
- **Graceful shutdown**: shutdown() called on all registered plugins in reverse registration order
- **Version compatibility**: check() validates plugin version against core version, returns CompatibilityResult
- **Installer**: install/uninstall/update from npm registry, search for available plugins
- **NPM registry**: search(), getDetails(), validate(), publish() for community plugins
- **Per-project overrides**: Plugin config can be overridden per-project in agent-orchestrator.yaml

### All 24 Plugin Packages

| Package | Slot | Purpose |
|---------|------|---------|
| `@composio/ao-plugin-runtime-tmux` | runtime | tmux session management |
| `@composio/ao-plugin-runtime-process` | runtime | direct process management |
| `@composio/ao-plugin-agent-claude-code` | agent | Claude Code integration |
| `@composio/ao-plugin-agent-codex` | agent | OpenAI Codex integration |
| `@composio/ao-plugin-agent-aider` | agent | Aider integration |
| `@composio/ao-plugin-agent-opencode` | agent | OpenCode integration |
| `@composio/ao-plugin-agent-glm` | agent | GLM integration |
| `@composio/ao-plugin-workspace-worktree` | workspace | Git worktree management |
| `@composio/ao-plugin-workspace-clone` | workspace | Git clone management |
| `@composio/ao-plugin-tracker-github` | tracker | GitHub issue tracking |
| `@composio/ao-plugin-tracker-linear` | tracker | Linear issue tracking |
| `@composio/ao-plugin-tracker-bmad` | tracker | BMAD file-based tracking |
| `@composio/ao-plugin-scm-github` | scm | GitHub SCM operations |
| `@composio/ao-plugin-notifier-desktop` | notifier | macOS/Linux desktop notifications |
| `@composio/ao-plugin-notifier-slack` | notifier | Slack notifications |
| `@composio/ao-plugin-notifier-discord` | notifier | Discord notifications |
| `@composio/ao-plugin-notifier-webhook` | notifier | Webhook notifications |
| `@composio/ao-plugin-notifier-composio` | notifier | Composio platform notifications |
| `@composio/ao-plugin-notifier-telegram` | notifier | Telegram notifications |
| `@composio/ao-plugin-terminal-iterm2` | terminal | iTerm2 terminal integration |
| `@composio/ao-plugin-terminal-web` | terminal | Web-based terminal |
| `@composio/ao-plugin-provider-raw` | provider | Raw provider (no enhancement) |
| `@composio/ao-plugin-provider-omc` | provider | OMC provider (session enhancement) |

### Testing Standards

- Verify method counts per interface match source
- Verify export pattern matches CLAUDE.md (manifest + create() + satisfies)
- Verify BUILTIN_PLUGINS contains all 8 default plugins
- Verify cross-links resolve to existing pages
- Verify no hero font classes
- Verify YAML config examples are valid
- Verify code examples compile (conceptually)

### Project Structure Notes

- Doc file location: `docs/advanced/custom-plugins.md`
- Nav order: 3 (third child under Advanced Topics, after monte-carlo)
- Parent: Advanced Topics (`docs/advanced/index.md`)
- Sibling pages: cross-project (1), monte-carlo (2), hooks-extensions (4), prompt-layers (5), production-deployment (6)
- Current stub says "Story 62.21" — incorrect, this is Story 62-50
- Plugin reference docs already exist at `docs/plugins/` — link to those, don't duplicate
- This is an **advanced guide** page (concepts + walkthrough + practical examples), NOT an API reference page

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.50]
- [Source: packages/core/src/types.ts — PluginSlot, PluginManifest, PluginModule<T>, PluginLifecycle, all slot interfaces]
- [Source: packages/core/src/plugin-registry.ts — BUILTIN_PLUGINS, register(), get(), list(), loadBuiltins(), loadFromConfig()]
- [Source: packages/core/src/plugin-loader.ts — scan(), loadPlugin(), permission system, PermissionError]
- [Source: packages/core/src/plugin-installer.ts — install(), uninstall(), update(), search(), disable(), enable()]
- [Source: packages/core/src/plugin-version-compatibility.ts — check(), CompatibilityResult]
- [Source: packages/core/src/plugin-npm-registry.ts — search(), getDetails(), validate(), publish()]
- [Source: packages/plugins/runtime-process/src/index.ts — Simplest runtime plugin example]
- [Source: packages/plugins/notifier-webhook/src/index.ts — Simple notifier plugin example]
- [Source: packages/plugins/workspace-worktree/src/index.ts — Moderate workspace plugin example]
- [Source: packages/plugins/scm-github/src/index.ts — Complex SCM plugin example]
- [Source: agent-orchestrator.yaml.example — Plugin config patterns]
- [Source: CLAUDE.md — Plugin pattern conventions, TypeScript conventions]
- [Source: docs/plugins/index.md — Existing plugins reference]

## Change Log

- 2026-04-27: Story created from sprint backlog
- 2026-04-27: Replaced 10-line stub in `docs/advanced/custom-plugins.md` with comprehensive Custom Plugin Development guide covering PluginModule interface, all 8 slot interfaces with method counts (required/optional), directory structure, step-by-step walkthrough (custom file-log notifier), plugin registry/loader/installer, version compatibility, testing patterns, configuration, and 3 code examples

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/advanced/custom-plugins.md` stub (10 lines) with comprehensive documentation
- All 16 acceptance criteria covered across 13 sections
- Sections: Overview, Plugin Architecture (PluginSlot/Manifest/Module/Lifecycle), Plugin Structure (directory/export/naming), Slot Interfaces (all 8 with required/optional method counts), Step-by-Step Guide (file-log notifier walkthrough), Plugin Registry (registration/retrieval/hot-reload/shutdown), Plugin Loader (scanning/validation/permissions), Plugin Installer (install/uninstall/update/search/disable/enable), Version Compatibility (check/status/ranges), Testing (mocks/export-verification/singleton-reset), Configuration (global/per-project/provider), Config Examples (3 examples)
- Front matter includes `description` field (was missing from stub)
- Cross-links verified: parent Advanced Topics, 5 sibling pages, Plugins Index, 3 getting-started pages (all 10 resolve)
- No hero font classes used
- All code blocks use correct syntax highlighting (typescript, json, yaml, bash)
- Method counts per interface verified against source:
  - Runtime: 5 required + 4 optional
  - Agent: 6 required + 3 optional
  - Workspace: 3 required + 3 optional
  - Tracker: 5 required + 10 optional
  - SCM: 11 required + 1 optional
  - Notifier: 1 required + 2 optional
  - Terminal: 2 required + 1 optional
  - SessionEnhancementProvider: 5 required
- Export pattern matches CLAUDE.md conventions (manifest + create + default with satisfies)
- BUILTIN_PLUGINS count verified: 20 entries (2 runtime, 4 agent, 2 workspace, 3 tracker, 1 scm, 4 notifier, 2 terminal, 2 provider)
- Step-by-step guide includes complete working example: file-log notifier with tests

### File List

- `docs/advanced/custom-plugins.md` — replaced stub with comprehensive Custom Plugin Development guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-27

### Review Findings

**Issues Found:** 0 HIGH, 2 MEDIUM, 3 LOW = 5 total
**Issues Fixed:** 5

#### MEDIUM Issues

1. **Plugin Loader conflates built-in and external loading**: The Plugin Loader section described `plugin.yaml` YAML manifests without clarifying this is for external/community plugins only. Built-in TypeScript plugins don't use YAML manifests — they're imported directly. **Fixed** — added "Two Loading Mechanisms" comparison table and clarified that YAML validation applies only to external plugins.

2. **Two manifest types conflated**: The doc used `PluginManifest` (4-field TypeScript interface from `types.ts`) for all contexts, but the Plugin Loader uses `PluginManifestWithMeta` (6-field YAML manifest from `plugin-loader.ts`) with additional `apiVersion`, `main`, and `permissions` fields. **Fixed** — renamed section heading to "PluginManifest (TypeScript)", added source attribution, and added Just the Docs note explaining the two types and when each is used.

#### LOW Issues

3. **Global notifiers config format incorrect**: Configuration section showed `notifiers:` as an array of objects with `name`/`config` keys, but the actual `agent-orchestrator.yaml.example` uses a keyed map format (`slack:` → `plugin: slack` → `webhook:`). **Fixed** — replaced example with actual format from `agent-orchestrator.yaml.example` including `defaults:` and `notifiers:` sections.

4. **Missing `## Overview` heading**: AC #2 specifies "Overview section" but the overview content was in the intro paragraph without a heading. **Fixed** — added explicit `## Overview` heading with expanded content mentioning agent-agnostic architecture and link to Plugins Index.

5. **getState()/setState() undocumented**: Hot Reload section referenced `getState()` and `setState()` methods without explaining them. These aren't part of the `PluginLifecycle` interface — they're informal duck-typed hooks. **Fixed** — expanded Hot Reload section to document both methods, explain they're detected via duck-typing (not a formal interface), and describe when plugins should implement them.

### Verification Summary

- All 16 ACs verified implemented
- All 10 cross-links resolve to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting
- Method counts per interface match source code
- Plugin config examples match `agent-orchestrator.yaml.example`
- Two manifest types now clearly distinguished
- Hot reload state preservation hooks now documented

### Outcome

**APPROVED** — All 5 issues fixed. Documentation accurately reflects source code types, config schema, and loading mechanisms.
