# Story 62.17: Agent Plugin Pages (claude-code, codex, aider, glm, opencode)

Status: done

## Story

As a developer using Agent Orchestrator,
I want detailed documentation pages for the five agent plugins (claude-code, codex, aider, glm, opencode), including an index page with a comparison table and individual pages covering each plugin's features, methods, configuration, and capabilities,
so that I can choose the right agent for my use case and configure it correctly.

## Acceptance Criteria

1. **Agent index page** (`docs/plugins/agents/index.md`) documents the agent slot with a comparison table of all 5 plugins — sourced from `packages/core/src/types.ts` Agent interface (lines 302-365)
2. **Agent index page** lists the Agent interface: 2 required readonly properties (`name`, `processName`), 1 optional readonly property (`promptDelivery`), 6 required methods (`getLaunchCommand`, `getEnvironment`, `detectActivity`, `getActivityState`, `isProcessRunning`, `getSessionInfo`), 4 optional methods (`getRestoreCommand`, `postLaunchSetup`, `setupWorkspaceHooks`, and deprecated `detectActivity` is required but deprecated)
3. **Agent index page** includes a comparison table covering: prompt delivery, session restore, workspace hooks, activity detection method, session introspection, cost tracking, lines of code — sourced from all 5 plugin implementations
4. **claude-code page** (`docs/plugins/agents/claude-code.md`) documents: plugin name, package (`@composio/ao-plugin-agent-claude-code`), version, description, default status — sourced from `packages/plugins/agent-claude-code/src/index.ts` manifest (lines 174-179)
5. **claude-code page** documents all Agent interface methods as implemented: `name`, `processName`, `promptDelivery`, `getLaunchCommand`, `getEnvironment`, `detectActivity`, `getActivityState`, `isProcessRunning`, `getSessionInfo`, `getRestoreCommand`, `postLaunchSetup`, `setupWorkspaceHooks` — sourced from `packages/plugins/agent-claude-code/src/index.ts` (lines 683-890)
6. **claude-code page** documents the PostToolUse hook system: writes `.claude/settings.json` with `metadata-updater.sh` that auto-updates metadata on `gh pr create`, `git checkout -b`, `gh pr merge` — sourced from lines 32-168, 592-677
7. **claude-code page** documents prompt delivery: `post-launch` mode (prompt sent via `runtime.sendMessage()` after agent starts, keeping Claude in interactive mode) — sourced from line 689
8. **claude-code page** documents session resume: `claude --resume {sessionUuid}` — sourced from lines 841-874
9. **claude-code page** documents JSONL session parsing: reads Claude's JSONL files from `~/.claude/projects/{encoded-path}/`, uses tail-reading (last 128KB) — sourced from lines 254-429
10. **claude-code page** documents activity detection: JSONL last entry type classification (`user`/`tool_use`/`progress` → active, `assistant`/`system`/`summary`/`result` → ready, `permission_request` → waiting_input, `error` → blocked) — sourced from lines 755-812
11. **codex page** (`docs/plugins/agents/codex.md`) documents: plugin name, package (`@composio/ao-plugin-agent-codex`), version, description — sourced from manifest (lines 35-40)
12. **codex page** documents shell wrapper system: `gh` and `git` wrapper scripts in `~/.ao/bin/` that auto-update metadata — sourced from lines 46-195
13. **codex page** documents app-server client: JSON-RPC 2.0 client for Codex's app-server mode — sourced from `app-server-client.ts` (505 lines)
14. **codex page** documents approval policy mapping: `"skip"` → `--dangerously-bypass-approvals-and-sandbox`, `"auto-edit"` → `--ask-for-approval never`, `"suggest"` → `--ask-for-approval untrusted` — sourced from lines 519-527
15. **aider page** (`docs/plugins/agents/aider.md`) documents: plugin name, package (`@composio/ao-plugin-agent-aider`), version, description — sourced from manifest (lines 59-64)
16. **aider page** documents activity detection: git commits (60s window) + `.aider.chat.history.md` mtime — sourced from lines 28-53, 115-147
17. **aider page** documents limitation: `getSessionInfo` returns `null` (no JSONL session files) — sourced from lines 200-203
18. **glm page** (`docs/plugins/agents/glm.md`) documents: thin wrapper around `createClaudeCompatibleAgent` from agent-claude-code, launches via `yolo -api`, inherits all methods — sourced from `packages/plugins/agent-glm/src/index.ts` (26 lines)
19. **opencode page** (`docs/plugins/agents/opencode.md`) documents: plugin name, package (`@composio/ao-plugin-agent-opencode`), version, description — sourced from manifest (lines 21-26)
20. **opencode page** documents limitations: `getActivityState` returns `null` (SQLite without per-workspace scoping), `getSessionInfo` returns `null` — sourced from lines 67-82, 135-138
21. **All six pages** use correct Just the Docs front matter: `parent`, `grand_parent`, `nav_order`, `has_children` (index only), `description` — verified against existing page hierarchy
22. **All code blocks** use correct syntax highlighting: `text` for diagrams, `typescript` for code, `yaml` for config, `bash` for commands
23. **No hero-style font classes** (`.fs-5`, `.fw-300`) on any page
24. **ASCII diagrams** (if any) stay under 60 chars display width
25. **Links** to parent Plugins index page and between agent child pages
26. **Config YAML examples** include `path` field in project configs (learned from Story 62-15)

## Tasks / Subtasks

- [x] Task 1: Write Agent index page (`docs/plugins/agents/index.md`) (AC: #1, #2, #3)
  - [x] Front matter: title, nav_order, parent, has_children, description
  - [x] Intro paragraph explaining Agent slot
  - [x] TL;DR callout: 5 plugins, claude-code default, comparison guidance
  - [x] Agent interface table: all methods (required + optional)
  - [x] Comparison table: all 5 plugins (prompt delivery, restore, hooks, detection, introspection, cost tracking)
  - [x] Links to child pages: claude-code, codex, aider, glm, opencode

- [x] Task 2: Write claude-code page (`docs/plugins/agents/claude-code.md`) (AC: #4, #5, #6, #7, #8, #9, #10)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version, default status
  - [x] How It Works section with ASCII diagram
  - [x] Agent methods table: all 12 properties/methods with descriptions
  - [x] PostToolUse hook system: metadata-updater.sh, settings.json
  - [x] Prompt delivery: post-launch mode explanation
  - [x] Session resume: claude --resume {sessionUuid}
  - [x] JSONL session parsing: tail-reading, summary extraction, cost tracking
  - [x] Activity detection: JSONL entry type classification
  - [x] Configuration YAML examples

- [x] Task 3: Write codex page (`docs/plugins/agents/codex.md`) (AC: #11, #12, #13, #14)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section
  - [x] Agent methods table
  - [x] Shell wrapper system: gh/git wrappers in ~/.ao/bin/
  - [x] Approval policy mapping table
  - [x] Binary resolution logic
  - [x] Configuration YAML examples

- [x] Task 4: Write aider page (`docs/plugins/agents/aider.md`) (AC: #15, #16, #17)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section
  - [x] Agent methods table
  - [x] Activity detection: git commits + chat history mtime
  - [x] Limitation: no session introspection (getSessionInfo returns null)
  - [x] Configuration YAML examples

- [x] Task 5: Write glm page (`docs/plugins/agents/glm.md`) (AC: #18)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: thin wrapper around claude-code
  - [x] Inheritance explanation: inherits all methods via createClaudeCompatibleAgent
  - [x] Launch command: `yolo -api`
  - [x] Configuration YAML examples

- [x] Task 6: Write opencode page (`docs/plugins/agents/opencode.md`) (AC: #19, #20)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] How It Works section
  - [x] Agent methods table
  - [x] Limitations: getActivityState and getSessionInfo return null
  - [x] Configuration YAML examples

- [x] Task 7: Verify navigation, formatting, and cross-links (AC: #21, #22, #23, #24, #25, #26)
  - [x] Front matter correct on all 6 pages (add `description` to index and all children)
  - [x] Code blocks use correct syntax highlighting
  - [x] No hero-style font classes
  - [x] ASCII diagrams under 60 chars
  - [x] Links to Plugins index and between pages work
  - [x] Config YAML examples include `path` field

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

**Not applicable** — This story modifies Jekyll markdown documentation pages. No TypeScript interfaces changed.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Design Decisions

- **6 files to edit**: `docs/plugins/agents/index.md` (parent page), `docs/plugins/agents/claude-code.md`, `docs/plugins/agents/codex.md`, `docs/plugins/agents/aider.md`, `docs/plugins/agents/glm.md`, `docs/plugins/agents/opencode.md`
- **Directory is `agents/` (plural)** — NOT `agent/`. All placeholders already exist at `docs/plugins/agents/`.
- **Agent interface has 2 required readonly properties + 1 optional readonly property + 6 required methods + 3 optional methods**: `name`, `processName` (required), `promptDelivery` (optional), `getLaunchCommand`, `getEnvironment`, `detectActivity` (deprecated but required), `getActivityState`, `isProcessRunning`, `getSessionInfo` (required), `getRestoreCommand`, `postLaunchSetup`, `setupWorkspaceHooks` (optional)
- **claude-code is the default agent**: Set in `DefaultPluginsSchema` (config.ts:184: `agent: z.string().default("claude-code")`)
- **glm is a thin wrapper**: Only 26 lines, delegates to `createClaudeCompatibleAgent` from `agent-claude-code`. Documents as "inherits from claude-code" with a link.
- **Plugins vary dramatically in complexity**: claude-code (901 lines) and codex (822+505 lines) are full-featured; aider (216 lines) and opencode (151 lines) are simpler; glm (26 lines) is a wrapper.

### Previous Story Learnings (62-16)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide
- Source accuracy matters — verify all technical claims against actual code
- Count precisely: method counts, parameter counts, line counts
- Config YAML examples need `path` field in project configs
- `description` field in front matter for searchability
- `promptDelivery` accuracy: describe exactly which path each agent uses
- When documenting inherited methods (glm), link to the parent plugin page

### Source Files

- **packages/core/src/types.ts** — Agent interface (lines 302-365), AgentLaunchConfig (lines 367-395), WorkspaceHooksConfig (lines 397-402), AgentSessionInfo (lines 404-413), CostEstimate (lines 415-419)
- **packages/core/src/config.ts** — DefaultPluginsSchema (line 184): agent defaults to "claude-code"
- **packages/plugins/agent-claude-code/src/index.ts** — claude-code plugin (901 lines): manifest (174-179), createClaudeCompatibleAgent factory (683-890), PostToolUse hooks (32-168, 592-677), JSONL parsing (254-429), process detection (441-554), terminal classification (561-586), activity detection via JSONL (755-812), session info via JSONL tail (814-839), restore command (841-874), ClaudeCompatibleAgentOptions interface (181-186)
- **packages/plugins/agent-codex/src/index.ts** — codex plugin (822 lines): manifest (35-40), shell wrappers (46-195), AGENTS.md section (206-217), binary resolution (482-512), approval policy mapping (519-527), model flags (530-540), session file discovery (283-471), activity detection (630-662), session info streaming (715-744), restore command (746-773)
- **packages/plugins/agent-codex/src/app-server-client.ts** — JSON-RPC 2.0 client for Codex app-server mode (505 lines)
- **packages/plugins/agent-aider/src/index.ts** — aider plugin (216 lines): manifest (59-64), git commit detection (28-39), chat history mtime (44-53), activity state (115-147), session info returns null (200-203)
- **packages/plugins/agent-glm/src/index.ts** — glm plugin (26 lines): thin wrapper, OPTIONS with name="glm", defaultCommand="yolo -api", defaultProcessName="yolo" (7-12), delegates to createClaudeCompatibleAgent (22)
- **packages/plugins/agent-opencode/src/index.ts** — opencode plugin (151 lines): manifest (21-26), activity detection returns null (67-82), session info returns null (135-138)
- **docs/plugins/index.md** — Parent Plugins index page (completed in Story 62-15, references agents/ on line 117)
- **docs/plugins/agents/index.md** — Placeholder (10 lines)
- **docs/plugins/agents/claude-code.md** — Placeholder (8 lines)
- **docs/plugins/agents/codex.md** — Placeholder (8 lines)
- **docs/plugins/agents/aider.md** — Placeholder (8 lines)
- **docs/plugins/agents/glm.md** — Placeholder (8 lines)
- **docs/plugins/agents/opencode.md** — Placeholder (8 lines)

### Key Agent Facts (verified against source)

**Agent interface properties (3):**
- `name: string` (required) — Agent display name
- `processName: string` (required) — Process name for detection (e.g. "claude", "codex", "aider")
- `promptDelivery?: "inline" | "post-launch"` (optional) — How prompt is delivered

**Agent interface required methods (6):**
- `getLaunchCommand(config)` — Build shell command to launch agent
- `getEnvironment(config)` — Get environment variables for process
- `detectActivity(terminalOutput)` — Detect activity from terminal output (DEPRECATED)
- `getActivityState(session, readyThresholdMs?)` — Get activity via agent-native mechanism
- `isProcessRunning(handle)` — Check if agent process is running
- `getSessionInfo(session)` — Extract summary, cost, session ID from agent data

**Agent interface optional methods (3):**
- `getRestoreCommand?(session, project)` — Build resume command for previous session
- `postLaunchSetup?(session)` — Run setup after agent launch
- `setupWorkspaceHooks?(workspacePath, config)` — Set up hooks for automatic metadata updates

**AgentLaunchConfig (8 fields):** sessionId, projectConfig, issueId?, prompt?, permissions?, model?, systemPrompt?, systemPromptFile?

**AgentSessionInfo (3 fields):** summary, summaryIsFallback?, agentSessionId, cost?

**CostEstimate (3 fields):** inputTokens, outputTokens, estimatedCostUsd

**Plugin comparison (verified against source):**

| Feature | claude-code | codex | aider | glm | opencode |
|---------|-------------|-------|-------|-----|----------|
| Source lines | 901 | 822 + 505 | 216 | 26 | 151 |
| promptDelivery | post-launch | default (inline) | default (inline) | post-launch | default (inline) |
| Activity detection | JSONL entry type | JSONL file mtime | git commits + chat mtime | JSONL (inherited) | Returns null |
| Session info | JSONL tail parsing | JSONL streaming | Returns null | JSONL (inherited) | Returns null |
| Cost tracking | Yes (Sonnet 4.5 pricing) | Yes ($2.5M/$10M) | No | Yes (inherited) | No |
| Session restore | `claude --resume` | `codex resume` | No | Yes (inherited) | No |
| Workspace hooks | PostToolUse hook | Shell wrappers | No | Yes (inherited) | No |
| postLaunchSetup | settings.json + hook | Shell wrappers + AGENTS.md | No | Yes (inherited) | No |
| Default | Yes | No | No | No | No |

**claude-code specifics:**
- `promptDelivery: "post-launch"` — prompt sent via runtime.sendMessage() to keep agent interactive
- `--dangerously-skip-permissions` flag in launch command
- System prompt via `--append-system-prompt "$(cat file)"` for long prompts
- `CLAUDECODE=""` env var suppresses Claude Code's own orchestrator UI
- `YOLO_HEADLESS=1` env var for headless operation
- PostToolUse hook in `.claude/settings.json` writes bash script `metadata-updater.sh`
- Claude project path encoding: strips leading `/`, replaces `/` and `.` with `-`
- JSONL session files at `~/.claude/projects/{encoded-path}/`
- Process list caching: `ps` results cached 5s (`PS_CACHE_TTL_MS`)
- Terminal output classification: prompt chars `^[❯>$#]\s*$` → idle, approval prompts → waiting_input, default → active

**codex specifics:**
- Shell wrappers in `~/.ao/bin/`: `gh` wrapper intercepts `pr create`/`pr merge`, `git` wrapper intercepts `checkout -b`/`switch -c`
- Shared `ao-metadata-helper.sh` with `update_ao_metadata()` function
- Atomic file writes: temp file + rename with `.ao-version` marker
- AGENTS.md section appended with "Agent Orchestrator (ao) Session"
- Binary resolution: checks `which codex`, then `/usr/local/bin`, `/opt/homebrew/bin`, `~/.cargo/bin`, `~/.npm/bin`
- Approval policy mapping: skip/auto-edit/suggest → specific CLI flags
- o-series model detection: adds `model_reasoning_effort=high` config for `o3`/`o4` models
- Session file discovery: recursive scan of `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- Session file caching: 30s TTL (`SESSION_FILE_CACHE_TTL_MS = 30_000`)
- App-server client: full JSON-RPC 2.0 with thread management, turn management, model discovery, approval handling

**aider specifics:**
- `--yes` flag for skip permissions, `--model` for model selection
- `--message` flag for prompt (inline delivery)
- Activity detection: `git log --since="60 seconds ago"` for recent commits, `.aider.chat.history.md` mtime for chat activity
- No session restore, no workspace hooks, no post-launch setup
- `getSessionInfo` returns `null` — no JSONL session files

**glm specifics:**
- Thin wrapper: 26 lines total
- Delegates to `createClaudeCompatibleAgent` from `@composio/ao-plugin-agent-claude-code`
- Launches via `yolo -api` (Claude Code compatible wrapper)
- Process name: `"yolo"` (not "glm")
- Inherits ALL methods from claude-code: activity detection, session info, restore, hooks

**opencode specifics:**
- `opencode run {prompt}` syntax for launch
- Activity detection returns `null` — SQLite without per-workspace scoping (`~/.local/share/opencode/opencode.db`)
- `getSessionInfo` returns `null` — no JSONL session files
- No session restore, no workspace hooks, no post-launch setup

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for method reference, comparison table, config fields
- `typescript` syntax highlighting for code examples
- `yaml` syntax highlighting for configuration examples
- `text` syntax highlighting for any ASCII diagrams
- `bash` syntax highlighting for command examples
- `has_children: true` for index page
- `grand_parent: Plugins` for child pages

### Important: Six File Changes

This story modifies:
1. `docs/plugins/agents/index.md` — Replace placeholder with full page
2. `docs/plugins/agents/claude-code.md` — Replace placeholder with full page
3. `docs/plugins/agents/codex.md` — Replace placeholder with full page
4. `docs/plugins/agents/aider.md` — Replace placeholder with full page
5. `docs/plugins/agents/glm.md` — Replace placeholder with full page
6. `docs/plugins/agents/opencode.md` — Replace placeholder with full page

### References

- [Source: packages/core/src/types.ts — Agent, AgentLaunchConfig, WorkspaceHooksConfig, AgentSessionInfo, CostEstimate]
- [Source: packages/plugins/agent-claude-code/src/index.ts — claude-code plugin (901 lines)]
- [Source: packages/plugins/agent-codex/src/index.ts — codex plugin (822 lines)]
- [Source: packages/plugins/agent-codex/src/app-server-client.ts — JSON-RPC 2.0 client (505 lines)]
- [Source: packages/plugins/agent-aider/src/index.ts — aider plugin (216 lines)]
- [Source: packages/plugins/agent-glm/src/index.ts — glm plugin (26 lines)]
- [Source: packages/plugins/agent-opencode/src/index.ts — opencode plugin (151 lines)]
- [Source: packages/core/src/config.ts — DefaultPluginsSchema (agent defaults to "claude-code")]
- [Source: docs/plugins/index.md — Parent Plugins page (Story 62-15)]
- [Source: Story 62-15 — Previous story learnings (callouts, formatting, accuracy)]
- [Source: Story 62-16 — Previous story learnings (diagram widths, source accuracy, cross-links)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1 (Agent index): Written as 102-line page with full comparison table, Agent interface docs, config examples
- Task 2 (claude-code): Written as 224-line page with JSONL parsing, PostToolUse hooks, cost tracking, session resume
- Task 3 (codex): Written as 232-line page with shell wrapper system, streaming JSONL parsing, approval policy mapping, binary resolution
- Task 4 (aider): Written as 162-line page with git-based activity detection, chat history mtime, limitation documentation
- Task 5 (glm): Written as 144-line page documenting thin wrapper around claude-code factory, inherited methods table
- Task 6 (opencode): Written as 140-line page with SQLite limitation documentation, minimal integration scope
- Task 7 (verification): Front matter consistent (parent, grand_parent, nav_order, description). No hero font classes. ASCII diagrams <60 chars. Cross-links verified. Config YAML has `path` field. Parent Plugins page references agents/ correctly (line 117). Total: 1004 lines across 6 files.
- Note: AC #13 (app-server client) was documented in the codex page's How It Works overview but the app-server client is an exported utility, not a core agent method. The primary codex documentation focuses on the agent implementation methods.

### File List

- `docs/plugins/agents/index.md` — Replaced 10-line placeholder with 102-line full page
- `docs/plugins/agents/claude-code.md` — Replaced 10-line placeholder with 224-line full page
- `docs/plugins/agents/codex.md` — Replaced 10-line placeholder with 232-line full page
- `docs/plugins/agents/aider.md` — Replaced 10-line placeholder with 162-line full page
- `docs/plugins/agents/glm.md` — Replaced 10-line placeholder with 144-line full page
- `docs/plugins/agents/opencode.md` — Replaced 10-line placeholder with 140-line full page

### Change Log

- **Code Review (2026-04-23):** Fixed 6 issues across 4 files:
  - H1: claude-code.md — Corrected `--append-system-prompts` → `--append-system-prompt` (singular) in How It Works diagram
  - M1: codex.md — Added "(implicit — no property set)" qualification to `promptDelivery` property value
  - M2: glm.md — Added missing `AO_AGENT_PROCESS_NAME` to inherited getEnvironment env var list
  - L1: Story artifact — Corrected `rollup-*.jsonl` → `rollout-*.jsonl` typo in Dev Notes
  - L2: codex.md — Added App-Server Client section documenting the JSON-RPC 2.0 utility
  - L3: index.md — Clarified codex complexity "822 + 505" with label "(agent + app-server client)"
