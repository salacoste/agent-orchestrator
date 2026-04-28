# Story 62.9: Autopilot Modes

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Autopilot Modes page documenting the 3 autopilot modes, mode switching, execution modes, safeguards, and integration with the spawn pipeline,
so that I can understand how autonomous agent spawning works and configure it safely for my projects.

## Acceptance Criteria

1. Page documents all 3 AutopilotMode values (off, supervised, autonomous) with descriptions and behavior — sourced from `packages/core/src/autopilot.ts` line 17 and `packages/core/src/types.ts` line 927
2. Comparison table shows all 3 modes with columns for trigger behavior, approval requirement, and notification timing — sourced from `autopilot.ts` lines 137-182
3. Mode switching mechanics documented: setMode(), approveSpawn(), paused state, runtime switching — sourced from `autopilot.ts` lines 193-201
4. Execution modes (standard, persistent, lightweight) documented as a separate concept from AutopilotMode — sourced from `packages/core/src/types.ts` line 1448, `packages/core/src/agent-mapping.ts` lines 20-41, `packages/core/src/session-timeout.ts` lines 21-28
5. Safeguards documented: SpawnQueue WIP limits, loop detector, business hours, supervised timeout (default 5 min) — sourced from `spawn-queue.ts`, `loop-detector.ts`, `business-hours.ts`, `autopilot.ts` line 49
6. Persistent execution mode documented: re-queue after verification failure, persistentMaxRetries (default 5) — sourced from `packages/core/src/verification-gate.ts` lines 378-405, `packages/core/src/types.ts` lines 1268-1274
7. Config reference shown with YAML example — sourced from `packages/core/src/config.ts` line 235
8. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 3)
9. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
10. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
11. Links to related pages: Sessions (62-7), Stories & Sprints (62-8), Reactions (62-10), Configuration (62-5)
12. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #8, #11, #12)
  - [x] Front matter: title: Autopilot, nav_order: 3, parent: Core Concepts, description
  - [x] One-paragraph intro explaining autopilot as autonomous story advancement
  - [x] TL;DR callout: 3 modes (off/supervised/autonomous), spawn queue integration, safeguards
  - [x] No hero-style font classes

- [x] Task 2: Write "Autopilot Modes" section (AC: #1, #10)
  - [x] ASCII diagram showing mode decision flow (under 60 chars wide)
  - [x] Mode descriptions table: off, supervised, autonomous with behavior
  - [x] Note: AutopilotMode is per-config, distinct from ExecutionMode per-session
  - [x] Source: packages/core/src/autopilot.ts line 17, types.ts line 927

- [x] Task 3: Write "Mode Comparison" section (AC: #2)
  - [x] Comparison table: Mode | Trigger | Approval | Notification | Use Case
  - [x] Sourced from autopilot.ts lines 137-182 (onStoryCompleted handler)
  - [x] Supervised timeout: default 5 minutes (300,000 ms) from autopilot.ts line 49

- [x] Task 4: Write "How Autopilot Works" section (AC: #3, #10)
  - [x] ASCII diagram showing story completion → autopilot → spawn pipeline flow (under 60 chars)
  - [x] Story discovery logic: reads sprint-status.yaml, first backlog entry matching pattern
  - [x] Mode switching: setMode() runtime switching, clears paused state
  - [x] approveSpawn() for supervised mode early approval
  - [x] Action log: MAX_ACTIONS = 20, ring buffer
  - [x] Source: autopilot.ts lines 72-220

- [x] Task 5: Write "Execution Modes" section (AC: #4)
  - [x] Table: standard, persistent, lightweight with timeout multipliers (1.0x, 3.0x, 0.5x)
  - [x] Default agent mappings per story type (exploration→lightweight, implementation→standard, etc.)
  - [x] Note: ExecutionMode is per-session, AutopilotMode is per-config (cross-link)
  - [x] Source: session-timeout.ts lines 21-28, agent-mapping.ts lines 20-41

- [x] Task 6: Write "Persistent Execution" section (AC: #6)
  - [x] Re-queue flow after verification failure
  - [x] persistentMaxRetries: default 5
  - [x] persistentMaxExtensions: default 3
  - [x] Source: verification-gate.ts lines 378-405, types.ts lines 1268-1274

- [x] Task 7: Write "Safeguards" section (AC: #5)
  - [x] SpawnQueue: WIP limits, priority-based scheduling
  - [x] Loop detector: prevents infinite spawn/restart cycles
  - [x] Business hours: timezone-aware spawn gating
  - [x] approvalRequired config: "autopilot-advance" gating
  - [x] No-next-story handling: autopilot pauses and notifies
  - [x] Source: spawn-queue.ts, loop-detector.ts, business-hours.ts, types.ts line 945

- [x] Task 8: Write "Configuration" section (AC: #7)
  - [x] YAML example showing autopilot, maxConcurrentAgents, approvalRequired
  - [x] Default values noted
  - [x] Source: config.ts line 235, types.ts lines 926-927

- [x] Task 9: Write navigation and next steps (AC: #8, #9, #11)
  - [x] Link to Sessions (../sessions/) — Story 62-7
  - [x] Link to Stories & Sprints (../stories-sprints/) — Story 62-8
  - [x] Link to Reactions (../reactions/) — Story 62-10
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

- **AutopilotMode vs ExecutionMode**: The documentation must clearly distinguish between AutopilotMode (3 values: off/supervised/autonomous, per-config) and ExecutionMode (3 values: standard/persistent/lightweight, per-session). These are different concepts that readers may confuse. Cross-link to Sessions page (62-7).
- **Supervised timeout = queue, not approve**: On supervised timeout, the spawn is QUEUED (not auto-approved). This was an explicit design decision from Story 43-1 party mode. The documentation must be precise about this.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.
- **Dashboard API routes not yet implemented**: The planned GET/POST /api/autopilot routes from Story 43-1 may not exist yet. Document only what's implemented in the core engine.

### Previous Story Learnings (62-7 Sessions, 62-8 Stories & Sprints)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands)
- ASCII diagrams MUST be under 60 chars wide — verified with awk after every edit
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest
- Code review caught: unexplained items in lists, diagram abbreviation footnotes, step count accuracy, opaque terminology — verify these categories for this story too
- Count enum values, step counts, field counts precisely against source code — these are the #1 source of High/Medium severity review findings
- Diagram abbreviations need footnotes explaining what they represent

### Source Files for Autopilot Modes Content

- **packages/core/src/autopilot.ts** (220 lines) — Full autopilot engine: AutopilotMode type (line 17), AutopilotAction (lines 20-31), AutopilotState (lines 34-38), AutopilotConfig (lines 43-52), Autopilot interface (lines 54-65), createAutopilot factory (line 72), story discovery (lines 84-107), mode handlers (lines 137-182), setMode/approveSpawn (lines 193-201)
- **packages/core/src/types.ts** — AutopilotMode in config (line 927), approvalRequired (line 945), ExecutionMode (line 1448), PersistentConfig (lines 1268-1274), BlockedAgentDetectorConfig (lines 2037-2048), ActiveModeState (lines 3601-3619)
- **packages/core/src/config.ts** — Zod schema: autopilot (line 235), approvalRequired (line 265), executionMode (line 101)
- **packages/core/src/agent-mapping.ts** lines 20-41 — Default execution mode per story type
- **packages/core/src/session-timeout.ts** lines 21-28 — Timeout multipliers by execution mode
- **packages/core/src/spawn-queue.ts** — WIP-limited queue that autopilot enqueues through
- **packages/core/src/business-hours.ts** — Timezone-aware business hours check
- **packages/core/src/loop-detector.ts** — Restart cycle breaker (autopilot safety)
- **packages/core/src/verification-gate.ts** lines 328-405 — Persistent execution mode: getExecutionMode, schedulePersistentRequeue
- **packages/core/src/completion-handlers.ts** lines 468-503 — Persistent re-queue after verification failure
- **packages/core/src/session-state.ts** line 23 — autopilot-state.json location
- **packages/core/src/__tests__/autopilot.test.ts** — 8 test cases covering all modes

### Key Autopilot Facts (verified against source)

**3 AutopilotMode values:** off, supervised, autonomous (autopilot.ts:17, types.ts:927)

**AutopilotAction type has 6 action types:** spawn-enqueued, spawn-failed, notification-sent, no-next-story, mode-changed, timeout-queued (autopilot.ts:20-31)

**AutopilotState fields:** mode (AutopilotMode), paused (boolean), recentActions (AutopilotAction[]) (autopilot.ts:34-38)

**Autopilot interface methods:** onStoryCompleted(storyId), getState(), setMode(mode), approveSpawn(storyId), stop() (autopilot.ts:54-65)

**Supervised timeout:** default 300,000 ms (5 minutes), configurable via supervisedTimeoutMs (autopilot.ts:49)

**Action log cap:** MAX_ACTIONS = 20 ring buffer (autopilot.ts line where defined)

**Story discovery pattern:** `^\d+[a-z]?-\d+-.+` — matches story keys, excludes epic-* and *-retrospective (autopilot.ts:84-107)

**3 ExecutionMode values:** standard, persistent, lightweight (types.ts:1448)

**Execution mode timeout multipliers:** standard=1.0x, persistent=3.0x, lightweight=0.5x (session-timeout.ts:21-28)

**Default agent mappings:**
- exploration → lightweight
- implementation → standard
- bugfix → standard
- review → lightweight
- default → standard
(agent-mapping.ts:20-41)

**Persistent config:** persistentMaxRetries default 5, persistentMaxExtensions default 3 (types.ts:1268-1274)

**approvalRequired values:** spawn, kill, autopilot-advance (types.ts:945, config.ts:265)

**Supervised timeout behavior:** On timeout expiry, spawn is QUEUED (not auto-approved) — explicit design decision from Story 43-1 (autopilot.ts:158-182)

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for mode comparison, execution modes, safeguards
- `text` syntax highlighting for ASCII diagrams
- `bash` syntax highlighting for CLI commands
- `yaml` syntax highlighting for config examples
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../sessions/` → `docs/core-concepts/sessions.md` (exists, updated in Story 62-7)
- `../stories-sprints/` → `docs/core-concepts/stories-sprints.md` (exists, updated in Story 62-8)
- `../reactions/` → `docs/core-concepts/reactions-engine.md` (placeholder, Story 62-10)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/autopilot.md`.

### References

- [Source: packages/core/src/autopilot.ts — AutopilotMode, AutopilotAction, AutopilotState, AutopilotConfig, Autopilot interface, createAutopilot]
- [Source: packages/core/src/types.ts line 927 — autopilot config, line 945 — approvalRequired, line 1448 — ExecutionMode, lines 1268-1274 — PersistentConfig]
- [Source: packages/core/src/config.ts line 235 — Zod autopilot schema, line 265 — approvalRequired schema, line 101 — executionMode schema]
- [Source: packages/core/src/agent-mapping.ts lines 20-41 — Default execution mode per story type]
- [Source: packages/core/src/session-timeout.ts lines 21-28 — Timeout multipliers by execution mode]
- [Source: packages/core/src/spawn-queue.ts — WIP-limited spawn queue]
- [Source: packages/core/src/business-hours.ts — Business hours check]
- [Source: packages/core/src/loop-detector.ts — Loop detection]
- [Source: packages/core/src/verification-gate.ts lines 328-405 — Persistent execution mode]
- [Source: packages/core/src/completion-handlers.ts lines 468-503 — Persistent re-queue]
- [Source: packages/core/src/__tests__/autopilot.test.ts — 8 test cases]
- [Source: _bmad-output/implementation-artifacts/43-1-autopilot-mode.md — Original implementation story]
- [Source: Story 62-7 — Previous story learnings (diagram width, callouts, source accuracy)]
- [Source: Story 62-8 — Previous story learnings (step count accuracy, abbreviation footnotes)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 12 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars (max: 57)
- 3 AutopilotMode values documented (off, supervised, autonomous) from autopilot.ts:17
- 3 ExecutionMode values documented (standard, persistent, lightweight) from types.ts:1448
- Mode comparison table with 4 aspects from autopilot.ts:137-182
- Execution mode timeout multipliers: standard=1.0x, persistent=3.0x, lightweight=0.5x from session-timeout.ts:21-28
- Default agent mappings: exploration→lightweight, implementation→standard, bugfix→standard, review→lightweight from agent-mapping.ts:20-41
- Persistent config: persistentMaxRetries=5, persistentMaxExtensions=3 from types.ts:1268-1274
- 6 AutopilotAction types documented from autopilot.ts:20-31
- Action log cap: MAX_ACTIONS = 20 from autopilot.ts:67
- Supervised timeout: 5 minutes default, spawn QUEUED (not auto-approved) from autopilot.ts:49
- Story discovery pattern documented from autopilot.ts:84-107
- Safeguards: SpawnQueue, Loop Detector, Business Hours, Approval Gates, No-Story Handling
- YAML config example with autopilot, maxConcurrentAgents, approvalRequired, persistent settings
- No hero-style font classes used on interior page
- `pnpm test` passes (only pre-existing provider-omc failures unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-21 | Created story artifact from epic and source analysis | Claude Sonnet 4 |
| 2026-04-21 | Rewrote autopilot.md from placeholder to full production page | Claude Sonnet 4 |
| 2026-04-21 | Code review: fixed 1M + 2L issues (title mismatch, action log placement, supervisedTimeoutMs in YAML) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4 on 2026-04-21
**Outcome:** Approved (with fixes applied)

**Findings (all fixed):**
- [M1] H1 heading `# Autopilot Modes` didn't match front matter `title: Autopilot` — changed H1 to `# Autopilot` for consistency with sibling pages
- [L1] Action Log was nested under Mode Comparison section — moved to its own `## Action Log` section
- [L2] supervisedTimeoutMs absent from Configuration YAML example — added with default value and comment

**Source Verification:**
- 3 AutopilotMode values verified against autopilot.ts:17 ✓
- 6 AutopilotAction types verified against autopilot.ts:20-31 ✓
- AutopilotState fields verified against autopilot.ts:34-38 ✓
- 5 Autopilot interface methods verified against autopilot.ts:54-65 ✓
- Supervised timeout default 300,000ms verified against autopilot.ts:77 ✓
- MAX_ACTIONS = 20 verified against autopilot.ts:67 ✓
- Story discovery pattern verified against autopilot.ts:98 ✓
- 3 ExecutionMode values verified against types.ts:1448 ✓
- Timeout multipliers (1.0x/3.0x/0.5x) verified against session-timeout.ts:21-28 ✓
- 5 default agent mappings verified against agent-mapping.ts:20-41 ✓
- PersistentConfig defaults (5/3) verified against types.ts:1268-1274 ✓
- 3 approvalRequired values verified against types.ts:945 ✓
- 6 AutopilotConfig fields verified against autopilot.ts:43-52 ✓
- Timeout clamping 1-60 min verified against session-timeout.ts:30-34 ✓
- Loop detector threshold 3 verified against loop-detector.ts:35 ✓
- ASCII diagrams all ≤ 60 chars verified with awk ✓

### File List

- `docs/core-concepts/autopilot.md` — rewritten from placeholder to full production page (~197 lines)
