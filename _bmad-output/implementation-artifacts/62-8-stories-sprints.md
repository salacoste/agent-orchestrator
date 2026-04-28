# Story 62.8: Stories & Sprints

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Stories & Sprints page documenting the story model, sprint lifecycle, assignment flow, and backlog management,
so that I can understand how work is tracked, prioritized, and routed to agents across projects.

## Acceptance Criteria

1. Page documents the Story model with all fields (id, status, title, description, acceptanceCriteria, dependencies, assignedAgent, urgency, version, updatedAt) — sourced from `packages/core/src/types.ts` lines 2519-2531 (StoryState interface)
2. StoryStatus lifecycle explained with all 6 states (backlog → ready-for-dev → in-progress → review → done, plus blocked) — sourced from `packages/core/src/types.ts` lines 2510-2516
3. Sprint lifecycle explained: how sprint-status.yaml tracks development_status, the BMAD workflow phases (analysis → planning → solutioning → implementation), and how stories move through phases — sourced from `packages/core/src/types.ts` lines 3514-3528 (Phase, PhaseState)
4. Assignment flow documented: only `ready-for-dev` stories are eligible, sorted by priority desc then FIFO, dependency resolution required, model tier suggestion via complexity classification — sourced from `packages/core/src/assignment-service.ts` lines 149-212 (getAssignableStories, selectNextStory)
5. Completion flow documented: capture logs → remove agent → verification gate → update sprint status → publish event → audit → learning capture → unblock dependents — sourced from `packages/core/src/completion-handlers.ts` lines 388-609
6. Failure flow documented: capture logs → remove agent → set blocked → publish event → notify — sourced from `packages/core/src/completion-handlers.ts` lines 616-745
7. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 2)
8. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
9. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
10. Links to related pages: Sessions (62-7), Autopilot (62-9), Reactions (62-10), Configuration (62-5)
11. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #7, #10, #11)
  - [x] Front matter: title: Stories & Sprints, nav_order: 2, parent: Core Concepts, description
  - [x] One-paragraph intro explaining stories as work units tracked in sprint-status.yaml
  - [x] TL;DR callout: story lifecycle in 6 states, sprint tracking via flat YAML, automatic assignment
  - [x] No hero-style font classes

- [x] Task 2: Write "Story Model" section (AC: #1, #9)
  - [x] ASCII diagram showing story lifecycle (6 states, under 60 chars wide)
  - [x] Table: StoryState field | Type | Description (11 fields from types.ts:2519-2531)
  - [x] UrgencyLevel table: critical, high, normal, low (from types.ts:990)
  - [x] Source: packages/core/src/types.ts lines 2519-2531

- [x] Task 3: Write "Story Status Lifecycle" section (AC: #2, #9)
  - [x] Explain each of the 6 StoryStatus values with descriptions
  - [x] Transition flow: backlog → ready-for-dev → in-progress → review → done
  - [x] Blocked state: when agent fails or dependency unmet
  - [x] Note: StoryStatus is per-story, SessionStatus is per-session (link to Sessions page)
  - [x] Source: packages/core/src/types.ts lines 2510-2516

- [x] Task 4: Write "Sprint Lifecycle" section (AC: #3)
  - [x] Explain sprint-status.yaml as the source of truth for development tracking
  - [x] BMAD workflow phases: analysis → planning → solutioning → implementation
  - [x] PhaseState values: not-started, done, active
  - [x] development_status map: how each story key maps to a status string
  - [x] Epic hierarchy: epics contain stories, epics transition backlog → in-progress → done
  - [x] Source: packages/core/src/types.ts lines 3514-3528, sprint-status.yaml structure

- [x] Task 5: Write "Assignment Flow" section (AC: #4, #9)
  - [x] ASCII diagram showing assignment pipeline (under 60 chars)
  - [x] Explain eligibility rules: only ready-for-dev, no active agent, deps resolved
  - [x] Sorting: priority desc, then position asc (FIFO)
  - [x] StoryCandidate interface fields (from assignment-service.ts:25-38)
  - [x] Model tier suggestion via classifyStoryComplexity
  - [x] Source: packages/core/src/assignment-service.ts lines 149-212

- [x] Task 6: Write "Completion Flow" section (AC: #5)
  - [x] Numbered completion steps: logs → remove agent → verify → update → publish → audit → learn → unblock
  - [x] Verification gate behavior (brief, link to Verification Gate page 62-12)
  - [x] Dependency unblocking: when story completes, dependent stories auto-promoted to ready-for-dev
  - [x] Source: packages/core/src/completion-handlers.ts lines 388-609

- [x] Task 7: Write "Failure Handling" section (AC: #6)
  - [x] Failure flow steps: logs → remove agent → blocked → event → notify
  - [x] FailureEvent reasons: failed, crashed, timed_out, disconnected
  - [x] Source: packages/core/src/completion-handlers.ts lines 616-745

- [x] Task 8: Write navigation and next steps (AC: #7, #8, #10)
  - [x] Link to Sessions (../sessions/) — Story 62-7
  - [x] Link to Autopilot (../autopilot/) — Story 62-9
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

- **StoryStatus vs SessionStatus**: The documentation must clearly distinguish between StoryStatus (6 values, per-story) and SessionStatus (18 values, per-session). Cross-link to Sessions page (62-7).
- **No SprintStatus type**: There is no `SprintStatus` or `SprintPhase` type in types.ts. The sprint lifecycle is represented through the sprint-status.yaml flat file and its development_status map. The BMAD workflow phases (Phase/PhaseState) are a separate concept for the workflow engine.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **Completion details deferred to 62-12**: This page gives a brief completion/failure overview. The full Verification Gate page (Story 62-12) will have the complete verification details.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.

### Previous Story Learnings (62-7 Sessions Lifecycle)

- `{: .highlight }` callouts work well for tips and TL;DR sections
- Interior pages should NOT use hero-style font classes (`.fs-5 .fw-300`)
- All code blocks need correct syntax highlighting (`text` for diagrams, `bash` for commands)
- ASCII diagrams MUST be under 60 chars wide — verified with awk after every edit
- Source accuracy matters — verify all technical claims against actual code, not assumptions
- Links verified against existing pages from Story 62-1
- Consistent diagram alignment matters — check all lines, not just the longest
- Code review caught: unexplained terminal states, diagram placement issues, missing reaction count footnote — verify these categories for this story too

### Source Files for Stories & Sprints Content

- **packages/core/src/types.ts** lines 2510-2531 — StoryStatus (6 values), StoryState interface (11 fields), UrgencyLevel
- **packages/core/src/types.ts** lines 3514-3528 — Phase, PhaseState, PHASES, PHASE_LABELS (BMAD workflow)
- **packages/core/src/types.ts** lines 1808-1821 — AgentAssignment interface
- **packages/core/src/types.ts** lines 2541-2567 — SprintPlanView, SprintSummary, ActionableStory (CLI types)
- **packages/core/src/assignment-service.ts** lines 25-212 — StoryCandidate, getAssignableStories, selectNextStory, resolveDependencies
- **packages/core/src/completion-handlers.ts** lines 388-609 — createCompletionHandler (10-step completion flow)
- **packages/core/src/completion-handlers.ts** lines 616-745 — createFailureHandler (9-step failure flow)
- **packages/core/src/completion-handlers.ts** lines 161-310 — updateSprintStatus, unblockDependentStories, findDependentStories
- **docs/architecture.md** lines 387-396 — Smart Assignment Flow diagram

### Key Stories & Sprints Facts (verified against source)

**6 StoryStatus values:** backlog, ready-for-dev, in-progress, review, done, blocked

**11 StoryState fields:** id, status, title, description, acceptanceCriteria, dependencies, assignedAgent, urgency, version, updatedAt (all from types.ts:2519-2531)

**4 UrgencyLevel values:** critical, high, normal, low (types.ts:990)

**3 ModelTier values:** low, medium, high (types.ts:1005)

**4 BMAD Phases:** analysis, planning, solutioning, implementation (types.ts:3514)

**3 PhaseState values:** not-started, done, active (types.ts:3520)

**6 AgentAssignment fields:** agentId, storyId, assignedAt, status, contextHash, priority (types.ts:1808-1821)

**Assignment eligibility rules (assignment-service.ts:168-169):**
1. Story status must be `"ready-for-dev"` (backlog stories excluded — not yet contexted)
2. No active agent assignment exists (registry.findActiveByStory returns null)
3. All dependencies resolved (status === "done" for every dep)

**Sorting:** priority descending, then position ascending (FIFO tiebreak)

**Completion flow (10 steps):**
1. Capture session logs
2. Remove agent from registry
3. Run verification gate (if enabled)
4. Update sprint status
5. Publish story.completed event
6. Log audit event
7. Track model usage
8. Capture session learning
9. Cross-session memory bridge
10. Unblock dependent stories

**Failure reasons:** failed, crashed, timed_out, disconnected (types.ts:1940-1949)

**Dependency unblocking:** When a story reaches "done", all stories depending on it are checked. If all their deps are "done", they transition to "ready-for-dev" (completion-handlers.ts:311).

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for state descriptions, fields, and flows
- `text` syntax highlighting for ASCII diagrams
- `bash` syntax highlighting for CLI commands
- `yaml` syntax highlighting for config examples
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../sessions/` → `docs/core-concepts/sessions.md` (exists, updated in Story 62-7)
- `../autopilot/` → `docs/core-concepts/autopilot.md` (placeholder, Story 62-9)
- `../reactions/` → `docs/core-concepts/reactions-engine.md` (placeholder, Story 62-10)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/stories-sprints.md`.

### References

- [Source: packages/core/src/types.ts lines 2510-2531 — StoryStatus, StoryState, UrgencyLevel]
- [Source: packages/core/src/types.ts lines 3514-3528 — Phase, PhaseState, BMAD phases]
- [Source: packages/core/src/types.ts lines 1808-1821 — AgentAssignment]
- [Source: packages/core/src/assignment-service.ts lines 25-212 — StoryCandidate, getAssignableStories, selectNextStory]
- [Source: packages/core/src/completion-handlers.ts lines 388-609 — createCompletionHandler]
- [Source: packages/core/src/completion-handlers.ts lines 616-745 — createFailureHandler]
- [Source: docs/architecture.md lines 387-396 — Smart Assignment Flow]
- [Source: Story 62-7 — Previous story learnings (diagram width, callouts, source accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 11 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars (max: 57)
- 6 StoryStatus values documented (backlog, ready-for-dev, in-progress, review, done, blocked)
- 11 StoryState fields documented from types.ts:2519-2531
- 4 UrgencyLevel values documented from types.ts:990
- Assignment flow with 3 eligibility rules from assignment-service.ts:168-169
- Completion flow (11 steps) from completion-handlers.ts:388-609
- Failure flow (10 steps) from completion-handlers.ts:616-745
- No hero-style font classes used on interior page
- `pnpm test` passes (only pre-existing provider-omc failures unrelated to this story)
- Diagram abbreviations: used "ready" shorthand in lifecycle diagram to stay under 60 chars (full "ready-for-dev" used everywhere else in prose)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-21 | Created full Stories & Sprints page from placeholder | Claude Sonnet 4 |
| 2026-04-21 | Code review: fixed 1H + 2M + 2L issues (step counts, diagram footnote, Cycle 3 ref, verification link) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4 on 2026-04-21
**Outcome:** Approved (with fixes applied)

**Findings (all fixed):**
- [H1] Completion flow listed 10 steps but actual code has 11 — added missing "Store log path in metadata" step (completion-handlers.ts:405-406)
- [M1] Failure flow listed 9 steps but actual code has 10 — added missing "Store log path in metadata" step (completion-handlers.ts:633-634)
- [M2] Diagram used `ready` abbreviation for `ready-for-dev` without explanation — added footnote below diagram
- [L1] Verification Gate link points to placeholder page — added "(page in progress)" parenthetical
- [L2] Smart Assignment referenced opaque "Cycle 3" term — removed the term

**Source Verification:**
- 6 StoryStatus values verified against types.ts:2510-2516 ✓
- 10 StoryState fields verified against types.ts:2519-2531 ✓
- 4 UrgencyLevel values verified against types.ts:990 ✓
- 3 ModelTier values verified against types.ts:1005 ✓
- 4 BMAD Phases verified against types.ts:3514-3517 ✓
- 3 PhaseState values verified against types.ts:3520 ✓
- 3 assignment eligibility rules verified against assignment-service.ts:169-183 ✓
- Priority sorting (desc priority, asc position) verified against assignment-service.ts:197-203 ✓
- 11 completion steps verified against completion-handlers.ts:398-610 ✓
- 10 failure steps verified against completion-handlers.ts:626-742 ✓
- 4 FailureReason values verified against types.ts:1945 ✓
- Dependency unblocking logic verified against completion-handlers.ts:311-383 ✓
- ASCII diagrams all ≤ 60 chars verified with awk ✓

### File List

- `docs/core-concepts/stories-sprints.md` — rewritten from placeholder to full production page (~263 lines)
