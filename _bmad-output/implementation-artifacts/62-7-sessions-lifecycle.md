# Story 62.7: Sessions Lifecycle

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Sessions lifecycle page documenting all 18 session states, transitions, the spawn pipeline, and completion flows,
so that I can understand how agent sessions move from creation to merge and troubleshoot issues at any stage.

## Acceptance Criteria

1. Page documents all 18 session states with descriptions, grouping them into active vs terminal categories (verified against `packages/core/src/types.ts` lines 41-59)
2. State transition table or diagram shows valid transitions with triggers (runtime check, agent activity, PR state, CI status, review decision) — sourced from `lifecycle-manager.ts` `determineStatus()`
3. Spawn pipeline explained as a numbered sequence covering: config resolution → workspace creation → runtime creation → agent launch → metadata write (sourced from `session-manager.ts` spawn function)
4. Completion flows documented: success path (merged), failure paths (errored, killed), human-intervention paths (needs_input, stuck), with terminal state list
5. Reaction triggers on state transitions explained briefly (with link to full Reactions page at `../reactions/` for Story 62-10)
6. ActivityState (6 values) explained as distinct from SessionStatus, showing how agent-detected activity feeds into lifecycle determination
7. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 1)
8. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
9. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
10. Links to related pages: Architecture Overview, Quick Start, Reactions (62-10), Autopilot (62-9)
11. No hero-style font classes (`.fs-5 .fw-300`) on interior pages (lesson from 62-3 review)

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #7, #10, #11)
  - [x] Front matter: title: Sessions, nav_order: 1, parent: Core Concepts, description
  - [x] One-paragraph intro explaining sessions as the core unit of work
  - [x] TL;DR callout: spawn → agent works → PR → merge, all automatic
  - [x] No hero-style font classes

- [x] Task 2: Write "Session States" section with all 18 states (AC: #1, #9)
  - [x] ASCII diagram showing key state transitions (under 60 chars wide)
  - [x] Table: State | Category (active/terminal) | Description
  - [x] Terminal states clearly marked: killed, terminated, done, cleanup, errored, merged
  - [x] Note: `merged` is the only non-restorable terminal state
  - [x] Source: packages/core/src/types.ts lines 41-59 (SessionStatus), lines 112-126 (TERMINAL_STATUSES, NON_RESTORABLE_STATUSES)

- [x] Task 3: Write "State Transitions" section (AC: #2, #9)
  - [x] Explain the 5-step priority order in determineStatus():
    1. Runtime alive check (not alive → killed)
    2. Agent activity detection (JSONL preferred, terminal fallback)
    3. PR auto-detection by branch
    4. PR state evaluation (merged > closed > ci_failed > changes_requested > approved > review_pending > pr_open)
    5. Fallback (spawning/stuck/needs_input auto-transition to working)
  - [x] State-to-event mapping table (12 mappings from statusToEventType)
  - [x] Source: lifecycle-manager.ts lines 107-136, 230-340

- [x] Task 4: Write "Spawn Pipeline" section (AC: #3)
  - [x] Numbered list of the ~24 spawn steps simplified to 17 key steps
  - [x] Source: session-manager.ts spawn function (lines 363-860)

- [x] Task 5: Write "Completion Flows" section (AC: #4)
  - [x] Happy path: working → pr_open → review_pending → approved → mergeable → merged
  - [x] CI failure auto-retry: pr_open → ci_failed → working (agent fixes) → pr_open
  - [x] Review changes: review_pending → changes_requested → working → pr_open
  - [x] Human intervention: working → needs_input (notify) / stuck (notify)
  - [x] Failure: working → errored / killed
  - [x] On killed/errored/stuck: reset tracker issue so story can be re-assigned
  - [x] Source: lifecycle-manager.ts lines 521-618, 710-814

- [x] Task 6: Write "Activity States" section (AC: #6)
  - [x] Table: ActivityState (6 values) | Meaning | How it maps to SessionStatus
  - [x] Values: active, ready, idle, waiting_input, blocked, exited
  - [x] Explain: ActivityState is agent-plugin-detected, SessionStatus is orchestrator-determined
  - [x] Source: packages/core/src/types.ts lines 61-78

- [x] Task 7: Write "Polling & Reactions" overview (AC: #5)
  - [x] LifecycleManager polls every 30 seconds
  - [x] On state change → fire event → check reaction config → execute if auto
  - [x] Brief reaction mapping table (6 key reactions) with link to full Reactions page
  - [x] Source: lifecycle-manager.ts lines 138-166, config.ts applyDefaultReactions

- [x] Task 8: Write "Session Metadata" section (AC: #8)
  - [x] Explain flat key=value file format in ~/.agent-orchestrator/{hash}/sessions/{id}
  - [x] List key metadata fields: worktree, branch, status, tmuxName, issue, pr, summary, project, agent, createdAt, role, exitCode
  - [x] CLI commands for inspecting sessions: ao list, ao logs, ao attach
  - [x] Source: docs/architecture.md metadata section

- [x] Task 9: Write navigation and next steps (AC: #7, #8, #10)
  - [x] Link to Architecture Overview (../../getting-started/architecture-overview/)
  - [x] Link to Quick Start (../../getting-started/quick-start/)
  - [x] Link to Reactions (../reactions/) — Story 62-10
  - [x] Link to Autopilot (../autopilot/) — Story 62-9
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

- **18 states, not 17**: The epics file says "17 session states" but the actual codebase defines 18 in `SessionStatus`. The documentation must match the code (18). Verified against types.ts lines 41-59.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **Spawn pipeline simplification**: The actual spawn function has ~24 internal steps. The documentation should present them as a high-level numbered sequence (15-20 steps) that captures the key phases without overwhelming the reader.
- **Reaction details deferred to 62-10**: This page gives a brief reaction overview with a link. The full Reactions Engine page (Story 62-10) will have the complete details.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.

### Previous Story Learnings (62-6 Architecture Overview)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands)
- ASCII diagrams MUST be under 60 chars wide — this was the #1 issue in 62-6 review (M2 severity)
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest

### Source Files for Session Lifecycle Content

- **packages/core/src/types.ts** lines 41-78 — SessionStatus (18 states), ActivityState (6 values), TERMINAL_STATUSES, NON_RESTORABLE_STATUSES, Session interface
- **packages/core/src/lifecycle-manager.ts** — State machine (determineStatus), polling loop, reaction engine, state-to-event mapping, event-to-reaction mapping, completion handlers
- **packages/core/src/session-manager.ts** lines 363-860 — Full spawn pipeline (24 steps), session CRUD
- **docs/architecture.md** lines 250-268 — Session Lifecycle State Machine section (ASCII diagram, polling order)
- **ARCHITECTURE.md** lines 36-57 — Service layer descriptions (SessionManager, LifecycleManager)
- **CLAUDE.md** — Architecture summary table, session naming, metadata format
- **packages/core/src/config.ts** lines 387-461 — applyDefaultReactions (11 default reactions)

### Key Session Lifecycle Facts (verified against source)

**18 SessionStatus values:** spawning, working, pr_open, ci_failed, review_pending, changes_requested, approved, mergeable, merged, cleanup, needs_input, stuck, errored, killed, done, terminated, blocked, paused

**6 Terminal states:** killed, terminated, done, cleanup, errored, merged

**1 Non-restorable state:** merged (all other terminal states can be restored)

**6 ActivityState values:** active, ready, idle, waiting_input, blocked, exited

**State-to-event mapping (12 of 18 states emit events):**
| Status | Event Type |
|--------|-----------|
| working | session.working |
| pr_open | pr.created |
| ci_failed | ci.failing |
| review_pending | review.pending |
| changes_requested | review.changes_requested |
| approved | review.approved |
| mergeable | merge.ready |
| merged | merge.completed |
| needs_input | session.needs_input |
| stuck | session.stuck |
| errored | session.errored |
| killed | session.killed |

**States with NO event:** spawning, cleanup, done, terminated, blocked, paused

**Polling:** 30-second default, re-entrancy guard, Promise.allSettled for concurrent session polling.

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for states, events, reactions
- `text` syntax highlighting for ASCII diagrams
- `bash` syntax highlighting for CLI commands
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages from Story 62-1:
- `../../getting-started/architecture-overview/` → `docs/getting-started/architecture-overview.md` (exists, updated in Story 62-6)
- `../../getting-started/quick-start/` → `docs/getting-started/quick-start.md` (exists, updated in Story 62-4)
- `../reactions/` → `docs/core-concepts/reactions.md` (placeholder, Story 62-10)
- `../autopilot/` → `docs/core-concepts/autopilot.md` (placeholder, Story 62-9)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/sessions.md`.

### References

- [Source: packages/core/src/types.ts lines 41-78 — SessionStatus, ActivityState, terminal sets]
- [Source: packages/core/src/lifecycle-manager.ts — determineStatus(), statusToEventType(), eventToReactionKey(), polling loop]
- [Source: packages/core/src/session-manager.ts lines 363-860 — spawn pipeline]
- [Source: docs/architecture.md lines 250-268 — Session Lifecycle State Machine]
- [Source: packages/core/src/config.ts lines 387-461 — applyDefaultReactions]
- [Source: Story 62-6 — ASCII diagram width lesson (M2: under 60 chars), interior page styling]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 11 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars (max: 60)
- 18 session states documented (not 17 as epics file stated — matches code)
- Spawn pipeline simplified from 24 internal steps to 17 key steps per Dev Notes design decision
- Reaction details deferred to Story 62-10 per Dev Notes
- No hero-style font classes used on interior page
- `pnpm test` passes (only pre-existing provider-omc failures unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-21 | Created full Sessions lifecycle page from placeholder | Claude Sonnet 4 |
| 2026-04-21 | Code review: fixed 2M + 3L issues (diagram, unexplained states, reaction count, OMC acronym, blocked collision) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4 on 2026-04-21
**Outcome:** Approved (with fixes applied)

**Findings (all fixed):**
- [M1] `done` and `cleanup` terminal states listed but never explained → added descriptions to table and callout
- [M2] State diagram showed `changes_requested` branching from `pr_open` instead of `review_pending` → moved to separate flow line
- [L1] Reaction table showed 6/11 reactions → added footnote listing 5 missing internal reactions
- [L2] OMC acronym unexplained → expanded to "OMC — oh-my-claudecode"
- [L3] `blocked` name collision between ActivityState and SessionStatus → added clarifying parenthetical

**Source Verification:**
- 18 SessionStatus values verified against types.ts:41-59 ✓
- 6 Terminal states verified against types.ts:113-120 ✓
- 12 state-to-event mappings verified against lifecycle-manager.ts:107-136 ✓
- 5-step determineStatus verified against lifecycle-manager.ts:231-340 ✓
- 6 ActivityState values verified against types.ts:62-68 ✓
- Polling interval 30s verified against lifecycle-manager.ts:823 ✓
- ASCII diagrams all ≤ 60 chars verified with awk ✓

### File List

- `docs/core-concepts/sessions.md` — rewritten from placeholder to full production page (~310 lines)
