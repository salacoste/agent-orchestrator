# Story 62.16: Runtime Plugin Pages (tmux, process)

Status: review

## Story

As a developer using Agent Orchestrator,
I want detailed documentation pages for the two runtime plugins (tmux and process), including an index page with a comparison table, individual pages covering each plugin's features, methods, configuration, and prerequisites,
so that I can choose the right runtime for my use case and configure it correctly.

## Acceptance Criteria

1. **Runtime index page** (`docs/plugins/runtime/index.md`) documents the runtime slot with a comparison table of tmux vs process — sourced from `packages/core/src/types.ts` Runtime interface (lines 225-260)
2. **tmux page** (`docs/plugins/runtime/tmux.md`) documents: plugin name, package (`@composio/ao-plugin-runtime-tmux`), version, description, prerequisites (tmux binary), default status — sourced from `packages/plugins/runtime-tmux/src/index.ts` manifest (lines 19-24)
3. **tmux page** documents all Runtime interface methods as implemented: `create`, `destroy`, `sendMessage`, `getOutput`, `isAlive`, `getMetrics`, `getAttachInfo`, `getExitCode`, `getSignal` — sourced from `packages/plugins/runtime-tmux/src/index.ts` (lines 42-209)
4. **tmux page** documents the long-command handling: commands >200 chars use `load-buffer`/`paste-buffer` instead of `send-keys` to avoid tmux/zsh truncation — sourced from `packages/plugins/runtime-tmux/src/index.ts` lines 61-80
5. **tmux page** documents session ID validation: only `[a-zA-Z0-9_-]` characters allowed — sourced from `packages/plugins/runtime-tmux/src/index.ts` line 27
6. **tmux page** documents environment variable injection via tmux `-e KEY=VALUE` flags — sourced from `packages/plugins/runtime-tmux/src/index.ts` lines 49-53
7. **tmux page** documents attach command: `tmux attach -t <session-name>` — sourced from `packages/plugins/runtime-tmux/src/index.ts` line 181
8. **tmux page** documents exit code behavior: returns `null` while alive, `undefined` when dead (tmux doesn't track exit codes) — sourced from `packages/plugins/runtime-tmux/src/index.ts` lines 185-196
9. **process page** (`docs/plugins/runtime/process.md`) documents: plugin name, package (`@composio/ao-plugin-runtime-process`), version, description, prerequisites — sourced from `packages/plugins/runtime-process/src/index.ts` manifest (lines 11-16)
10. **process page** documents all Runtime interface methods as implemented: `create`, `destroy`, `sendMessage`, `getOutput`, `isAlive`, `getMetrics`, `getAttachInfo`, `getExitCode`, `getSignal` — sourced from `packages/plugins/runtime-process/src/index.ts` (lines 35-310)
11. **process page** documents the rolling output buffer: capped at 1000 lines (`MAX_OUTPUT_LINES`), separate partial-line buffers for stdout/stderr — sourced from `packages/plugins/runtime-process/src/index.ts` lines 33, 109-124
12. **process page** documents the graceful shutdown: SIGTERM to process group (negative PID), 5-second grace period, then SIGKILL — sourced from `packages/plugins/runtime-process/src/index.ts` lines 151-197
13. **process page** documents spawn behavior: `shell: true`, `detached: true` (own process group), `stdio: ["pipe", "pipe", "pipe"]` — sourced from `packages/plugins/runtime-process/src/index.ts` lines 63-70
14. **process page** documents exit code behavior: returns actual `child.exitCode` when available, `null` while running, `undefined` if process never existed — sourced from `packages/plugins/runtime-process/src/index.ts` lines 284-296
15. **Runtime index page** includes a comparison table covering: persistence, use case, session lifetime, prerequisites, attach support, output capture — sourced from both plugin implementations
16. **All three pages** use correct Just the Docs front matter: `parent`, `grand_parent`, `nav_order`, `has_children` (index only) — verified against existing page hierarchy
17. **All code blocks** use correct syntax highlighting: `text` for diagrams, `typescript` for code, `yaml` for config, `bash` for commands
18. **No hero-style font classes** (`.fs-5`, `.fw-300`) on any page
19. **ASCII diagrams** (if any) stay under 60 chars display width
20. **Links** to parent Plugins index page and between tmux/process child pages

## Tasks / Subtasks

- [x] Task 1: Write Runtime index page (`docs/plugins/runtime/index.md`) (AC: #1, #15, #16)
  - [x] Front matter: title, nav_order, parent, has_children, description
  - [x] Intro paragraph explaining Runtime slot
  - [x] TL;DR callout: 2 plugins, tmux default, process for lightweight use
  - [x] Comparison table: tmux vs process (persistence, use case, prerequisites, attach, output, lifetime)
  - [x] Links to child pages: tmux, process

- [x] Task 2: Write tmux page (`docs/plugins/runtime/tmux.md`) (AC: #2, #3, #4, #5, #6, #7, #8)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version, default status
  - [x] Prerequisites section: tmux binary must be installed
  - [x] Runtime methods table: all 9 methods with descriptions
  - [x] Long-command handling: >200 chars uses load-buffer/paste-buffer
  - [x] Session ID validation: SAFE_SESSION_ID regex
  - [x] Environment injection: -e KEY=VALUE flags
  - [x] Attach info: tmux attach command
  - [x] Exit code behavior: null while alive, undefined when dead
  - [x] Configuration YAML example showing runtime: tmux

- [x] Task 3: Write process page (`docs/plugins/runtime/process.md`) (AC: #9, #10, #11, #12, #13, #14)
  - [x] Front matter: title, nav_order, parent, grand_parent, description
  - [x] Plugin overview: name, package, version
  - [x] Prerequisites: none (uses Node.js built-in child_process)
  - [x] Runtime methods table: all 9 methods with descriptions
  - [x] Rolling output buffer: 1000-line cap, per-stream partial buffers
  - [x] Graceful shutdown: SIGTERM → 5s grace → SIGKILL, process group kill
  - [x] Spawn configuration: shell:true, detached:true, stdio pipes
  - [x] Exit code behavior: actual exitCode from child process
  - [x] Configuration YAML example showing runtime: process

- [x] Task 4: Verify navigation, formatting, and cross-links (AC: #16, #17, #18, #19, #20)
  - [x] Front matter correct on all 3 pages
  - [x] Code blocks use correct syntax highlighting
  - [x] No hero-style font classes
  - [x] ASCII diagrams under 60 chars (max 48, verified)
  - [x] Links to Plugins index and between pages work

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

- **3 files to edit**: `docs/plugins/runtime/index.md` (parent page), `docs/plugins/runtime/tmux.md`, `docs/plugins/runtime/process.md`
- **Both plugins implement all 9 Runtime methods**: 5 required (`create`, `destroy`, `sendMessage`, `getOutput`, `isAlive`) + 4 optional (`getMetrics`, `getAttachInfo`, `getExitCode`, `getSignal`)
- **tmux is the default runtime**: Set in `DefaultPluginsSchema` (config.ts:182)
- **process plugin uses `shell: true`**: Intentional because launchCommand comes from trusted YAML config and may contain pipes, redirects, or shell syntax (source: runtime-process/index.ts line 60)
- **process plugin uses `detached: true`**: Creates own process group so `destroy()` can kill child commands, not just the shell (source: runtime-process/index.ts line 69)
- **tmux long-command handling**: Commands >200 chars get mangled by tmux/zsh `send-keys`, so the plugin uses `load-buffer`/`paste-buffer` instead (source: runtime-tmux/index.ts lines 61-80)
- **Comparison table is the key differentiator**: Users need to understand when to use each plugin

### Previous Story Learnings (62-15)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands, `yaml` for config)
- ASCII diagrams MUST be under 60 chars wide
- Source accuracy matters — verify all technical claims against actual code
- Count precisely: method counts, parameter counts, line counts
- Config YAML examples need `path` field in project configs
- `description` field in front matter for searchability
- Async methods marked distinctly in documentation

### Source Files

- **packages/core/src/types.ts** — Runtime interface (lines 225-260), RuntimeCreateConfig (lines 262-267), RuntimeHandle (lines 270-277), RuntimeMetrics (lines 279-283), AttachInfo (lines 285-292)
- **packages/plugins/runtime-tmux/src/index.ts** — tmux plugin implementation (213 lines): manifest (19-24), create (45-103), destroy (106-112), sendMessage (114-151), getOutput (153-158), isAlive (161-168), getMetrics (170-175), getAttachInfo (177-183), getExitCode (185-196), getSignal (199-209), SAFE_SESSION_ID (27)
- **packages/plugins/runtime-process/src/index.ts** — process plugin implementation (314 lines): manifest (11-16), create (42-149), destroy (151-199), sendMessage (202-238), getOutput (241-248), isAlive (250-254), getMetrics (256-262), getAttachInfo (264-282), getExitCode (284-296), getSignal (298-310), SAFE_SESSION_ID (19), MAX_OUTPUT_LINES (33)
- **packages/core/src/config.ts** — DefaultPluginsSchema (lines 182-187): runtime defaults to "tmux"
- **docs/plugins/index.md** — Parent Plugins index page (completed in Story 62-15)
- **docs/plugins/runtime/index.md** — Placeholder (10 lines)
- **docs/plugins/runtime/tmux.md** — Placeholder (10 lines)
- **docs/plugins/runtime/process.md** — Placeholder (10 lines)

### Key Runtime Facts (verified against source)

**Runtime interface (8 methods, 5 required + 4 optional):**
- `create(config)` — Create session, returns RuntimeHandle
- `destroy(handle)` — Destroy session
- `sendMessage(handle, message)` — Send text to agent
- `getOutput(handle, lines?)` — Capture recent output
- `isAlive(handle)` — Check if session is alive
- `getMetrics?(handle)` — Get resource metrics (optional)
- `getAttachInfo?(handle)` — Get attachment info (optional)
- `getExitCode?(handle)` — Get exit code (optional)
- `getSignal?(handle)` — Get termination signal (optional)

**RuntimeCreateConfig (4 fields):** sessionId, workspacePath, launchCommand, environment

**RuntimeHandle (3 fields):** id, runtimeName, data

**RuntimeMetrics (3 fields):** uptimeMs (required), memoryMb?, cpuPercent?

**AttachInfo (3 fields):** type, target, command?

**tmux specifics:**
- Uses `execFile("tmux", ...)` for all operations (security: no shell injection)
- Session ID validation: `SAFE_SESSION_ID = /^[a-zA-Z0-9_-]+$/`
- Long commands (>200 chars): uses `load-buffer` + `paste-buffer` with temp file
- Short commands: uses `send-keys -l` (literal mode, no tmux key interpretation)
- Multiline messages: also uses load-buffer/paste-buffer
- sendMessage clears partial input with `C-u` before sending
- 300ms delay after paste before pressing Enter
- Exit code: `null` while alive, `undefined` when dead (tmux limitation)
- Attach command: `tmux attach -t <session-name>`
- Temp files for paste: written to `os.tmpdir()`, mode 0o600, cleaned up in finally block

**process specifics:**
- Uses `spawn()` with `shell: true`, `detached: true`
- Rolling output buffer: MAX_OUTPUT_LINES = 1000
- Per-stream partial-line buffers to prevent interleaving
- Graceful shutdown: SIGTERM to process group (negative PID), 5s grace, then SIGKILL
- stdin write wrapped in Promise with done-flag to prevent double resolve/reject
- Exit code: actual `child.exitCode` when available
- Signal: `child.signalCode` when available

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for method reference, comparison table, config fields
- `typescript` syntax highlighting for code examples
- `yaml` syntax highlighting for configuration examples
- `text` syntax highlighting for any ASCII diagrams
- `has_children: true` for index page
- `grand_parent: Plugins` for child pages

### Important: Three File Changes

This story modifies:
1. `docs/plugins/runtime/index.md` — Replace placeholder with full page
2. `docs/plugins/runtime/tmux.md` — Replace placeholder with full page
3. `docs/plugins/runtime/process.md` — Replace placeholder with full page

### References

- [Source: packages/core/src/types.ts — Runtime, RuntimeCreateConfig, RuntimeHandle, RuntimeMetrics, AttachInfo]
- [Source: packages/plugins/runtime-tmux/src/index.ts — tmux plugin implementation]
- [Source: packages/plugins/runtime-process/src/index.ts — process plugin implementation]
- [Source: packages/core/src/config.ts — DefaultPluginsSchema]
- [Source: docs/plugins/index.md — Parent Plugins page (Story 62-15)]
- [Source: Story 62-15 — Previous story learnings (callouts, formatting, accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No errors encountered during implementation.

### Completion Notes List

1. Verified Runtime interface has 9 methods (5 required + 4 optional) — types.ts:225-260
2. Verified RuntimeCreateConfig has 4 fields — types.ts:262-267
3. Verified RuntimeHandle has 3 fields — types.ts:270-277
4. Verified RuntimeMetrics has 3 fields — types.ts:279-283
5. Verified AttachInfo has 3 fields and 5 type values — types.ts:285-292
6. tmux plugin: all 9 methods documented from runtime-tmux/src/index.ts (213 lines)
7. process plugin: all 9 methods documented from runtime-process/src/index.ts (314 lines)
8. tmux long-command handling: >200 chars uses load-buffer/paste-buffer (lines 61-80)
9. tmux sendMessage: clears input with C-u, uses -l flag for literal mode (lines 114-151)
10. tmux exit code behavior: null while alive, undefined when dead (tmux limitation)
11. process rolling buffer: MAX_OUTPUT_LINES = 1000, per-stream partial buffers (lines 33, 109-124)
12. process graceful shutdown: SIGTERM → 5s → SIGKILL, process group via negative PID (lines 151-197)
13. process spawn: shell:true (trusted YAML config), detached:true (process group) (lines 63-70)
14. process exit code: actual child.exitCode, null while running, undefined if cleaned up
15. ASCII diagrams fixed — initial widths up to 76 chars, all trimmed to ≤48 chars
16. Front matter verified: index (has_children=true), tmux/process (grand_parent=Plugins)
17. No hero-style font classes used
18. Comparison table on index page covers 9 dimensions
19. YAML config examples include path field in project configs
20. Cross-links between all pages and parent Plugins index

### File List

- `docs/plugins/runtime/index.md` — Complete rewrite from placeholder to full page
- `docs/plugins/runtime/tmux.md` — Complete rewrite from placeholder to full page
- `docs/plugins/runtime/process.md` — Complete rewrite from placeholder to full page
- `_bmad-output/implementation-artifacts/62-16-runtime-plugins-tmux-process.md` — Status updated, tasks marked complete, Dev Agent Record filled
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 62-16 status: ready-for-dev → in-progress

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Claude Opus 4.6 | Story created from epic 62 specification |
| 2026-04-23 | Claude Opus 4.6 | Implementation complete — all 4 tasks done, all 20 ACs met |
| 2026-04-23 | Claude Opus 4.6 | Code review: PASS — 3 LOW fixes applied (300ms delay accuracy, create() pseudo-steps, process diagram placeholder) |
