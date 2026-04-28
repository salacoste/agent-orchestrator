# Story 62.10: Reactions Engine

Status: done

## Story

As a developer using Agent Orchestrator,
I want a detailed Reactions Engine page documenting the default auto-reactions, trigger conditions, action flows, escalation behavior, and custom configuration,
so that I can understand how automated event responses work and configure them for my projects.

## Acceptance Criteria

1. Page documents all 11 default reaction keys with their trigger events, actions, and config — sourced from `packages/core/src/config.ts` lines 386-461 and `packages/core/src/lifecycle-manager.ts` lines 138-166
2. 3 reaction action types documented (send-to-agent, notify, auto-merge) with descriptions — sourced from `packages/core/src/types.ts` line 845
3. ReactionConfig interface fields documented (8 fields: auto, action, message, priority, retries, escalateAfter, threshold, includeSummary) — sourced from `packages/core/src/types.ts` lines 839-864
4. Trigger-to-reaction mapping shown (11 EventType → reaction key pairs) — sourced from `packages/core/src/lifecycle-manager.ts` lines 138-166
5. Escalation logic documented: attempt-based (retries), duration-based (escalateAfter string), count-based (escalateAfter number) — sourced from `packages/core/src/lifecycle-manager.ts` lines 360-395
6. CI fix and review address flows shown as worked examples with step-by-step pipeline — sourced from `packages/core/src/lifecycle-manager.ts` lines 342-420
7. Custom configuration section with YAML examples for global and per-project overrides — sourced from `packages/core/src/config.ts` line 244 (global), line 171 (per-project), `packages/core/src/types.ts` lines 1120-1121
8. Uses Just the Docs front matter with correct parent navigation (parent: Core Concepts, nav_order: 4)
9. All code blocks use `text`, `typescript`, `yaml`, or `bash` syntax highlighting
10. ASCII diagrams render correctly in Jekyll markdown and stay under 60 chars wide for mobile readability
11. Links to related pages: Sessions (62-7), Autopilot (62-9), Configuration (62-5), Stories & Sprints (62-8)
12. No hero-style font classes (`.fs-5 .fw-300`) on interior pages

## Tasks / Subtasks

- [x] Task 1: Write page header and intro (AC: #8, #11, #12)
  - [x] Front matter: title: Reactions Engine, nav_order: 4, parent: Core Concepts, description
  - [x] One-paragraph intro explaining reactions as automated event-response system
  - [x] TL;DR callout: 11 default reactions, 3 action types, event-driven triggers, escalation, per-project overrides
  - [x] No hero-style font classes

- [x] Task 2: Write "How Reactions Work" section (AC: #4, #10)
  - [x] ASCII diagram showing event → reaction evaluation pipeline (under 60 chars wide)
  - [x] Explain: polling loop (30s default), state detection, event mapping, config resolution, execution
  - [x] Trigger-to-reaction mapping table: 11 EventType → reaction key pairs
  - [x] Source: lifecycle-manager.ts lines 107-166, 487-640

- [x] Task 3: Write "Default Reactions" section (AC: #1, #2)
  - [x] Table of all 11 default reactions: key, auto, action, priority, retries, escalateAfter, threshold
  - [x] Group by action type: send-to-agent (4), notify (6), auto-merge context
  - [x] 3 action type descriptions in separate table
  - [x] Source: config.ts lines 386-461, types.ts line 845

- [x] Task 4: Write "Reaction Configuration" section (AC: #3)
  - [x] ReactionConfig field table: 8 fields with types and descriptions
  - [x] 4 EventPriority levels: urgent, action, warning, info
  - [x] 5 ReactionResult fields
  - [x] Source: types.ts lines 839-864, 866-872, 770

- [x] Task 5: Write "CI Fix Flow" worked example (AC: #6, #10)
  - [x] ASCII diagram showing CI failure → ci-failed reaction → agent fix → escalation (under 60 chars)
  - [x] Step-by-step: event detected → reaction matched → message sent → retry tracking → escalation
  - [x] Note retries: 2, escalateAfter: 2 attempts
  - [x] Source: lifecycle-manager.ts lines 342-420

- [x] Task 6: Write "Review Address Flow" worked example (AC: #6, #10)
  - [x] ASCII diagram showing review comments → changes-requested reaction (under 60 chars)
  - [x] Step-by-step: changes requested → reaction triggered → agent notified → escalation after 30m
  - [x] Source: lifecycle-manager.ts lines 342-420

- [x] Task 7: Write "Escalation" section (AC: #5)
  - [x] 3 escalation triggers: attempt-based (retries), duration-based (escalateAfter string), count-based (escalateAfter number)
  - [x] parseDuration: supports s/m/h units
  - [x] On escalation: reaction.escalated event, human notified at priority
  - [x] Tracker cleanup: cleared on status change, pruned on poll cycle
  - [x] Source: lifecycle-manager.ts lines 360-395, 44-58, 694-707

- [x] Task 8: Write "Custom Configuration" section (AC: #7)
  - [x] YAML example: global reactions config
  - [x] YAML example: per-project reaction overrides
  - [x] Explain merge behavior: { ...globalReaction, ...projectReaction }
  - [x] Note: per-project uses Partial<ReactionConfig> — any subset of fields
  - [x] Source: config.ts line 244, line 171, types.ts lines 1120-1121

- [x] Task 9: Write navigation and next steps (AC: #8, #9, #11)
  - [x] Link to Sessions (../sessions/) — Story 62-7
  - [x] Link to Autopilot (../autopilot/) — Story 62-9
  - [x] Link to Stories & Sprints (../stories-sprints/) — Story 62-8
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

- **11 default reactions, not 6**: The epic description says "6 default auto-reactions" but the actual source code defines 11 reaction keys in `config.ts`. The documentation must match the code, not the epic. List all 11.
- **Reactions live in LifecycleManager**: There is no standalone `reaction-engine.ts` file. The reaction evaluation, execution, and escalation logic is embedded in `packages/core/src/lifecycle-manager.ts`. The documentation should describe the feature, not the file structure.
- **auto: false vs auto: true**: The `approved-and-green` reaction has `auto: false` by default — it only notifies, doesn't auto-merge. The other 10 reactions have `auto: true`. This distinction is important to document.
- **ASCII diagrams over Mermaid**: Jekyll/Just the Docs does not reliably render Mermaid. Use ASCII art in `text` fenced code blocks, under 60 chars wide for mobile.
- **No hero fonts**: Interior pages should NOT use `.fs-5 .fw-300` hero-style classes.
- **Front matter title vs H1**: Must match. Previous story (62-9) had a mismatch that was caught in code review. Both should be "Reactions Engine".

### Previous Story Learnings (62-7, 62-8, 62-9)

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
- **Title consistency**: Front matter `title` must match H1 heading. Caught in 62-9 review.

### Source Files for Reactions Engine Content

- **packages/core/src/lifecycle-manager.ts** (855 lines) — Primary reaction engine: eventToReactionKey mapping (lines 138-166), statusToEventType (line 107), executeReaction (lines 342-420), ReactionTracker (lines 174-178), parseDuration (lines 44-58), tracker cleanup (lines 694-707), all-complete trigger (lines 709-724), tracker-story-done trigger (lines 550-595), tracker-sprint-complete trigger (lines 726-786), poll interval constant (line 823)
- **packages/core/src/types.ts** — ReactionConfig interface (lines 839-864), ReactionResult interface (lines 866-872), EventPriority (line 770), EventType union (lines 773-821), per-project reactions field (lines 1120-1121)
- **packages/core/src/config.ts** — ReactionConfigSchema (lines 25-34), applyDefaultReactions with 11 defaults (lines 386-461), global reactions schema (line 244), per-project reactions schema (line 171)
- **packages/core/src/prompt-builder.ts** lines 107-120 — Injects reaction hints into agent prompts
- **packages/core/src/orchestrator-prompt.ts** lines 129-148 — Documents configured reactions in system prompt
- **packages/core/src/__tests__/lifecycle-manager.test.ts** (1,881 lines) — 31+ reaction-related test cases
- **docs/architecture.md** lines 92-110 — Reaction Layer section with summary table

### Key Reactions Engine Facts (verified against source)

**11 default reaction keys:** ci-failed, changes-requested, bugbot-comments, merge-conflicts, approved-and-green, agent-stuck, agent-needs-input, agent-exited, all-complete, tracker-story-done, tracker-sprint-complete (config.ts:386-461)

**3 action types:** send-to-agent, notify, auto-merge (types.ts:845)

**8 ReactionConfig fields:** auto (boolean), action (3-value union), message (string?), priority (EventPriority?), retries (number?), escalateAfter (number|string?), threshold (string?), includeSummary (boolean?) (types.ts:839-864)

**5 ReactionResult fields:** reactionType, success, action, message (optional), escalated (types.ts:866-872)

**4 EventPriority levels:** urgent, action, warning, info (types.ts:770)

**11 EventType → reaction key mappings:** (lifecycle-manager.ts:138-166)

**ReactionTracker fields:** attempts (number), firstTriggered (Date) (lifecycle-manager.ts:174-178)

**Default poll interval:** 30,000 ms (30 seconds) (lifecycle-manager.ts:823)

**Default auto:** true (config.ts:26)

**Default action:** "notify" (config.ts:27)

**Default max retries:** Infinity when not set (lifecycle-manager.ts:361)

**parseDuration units:** s (seconds), m (minutes), h (hours) (lifecycle-manager.ts:44-58)

**Per-project config merge:** { ...globalReaction, ...projectReaction } (lifecycle-manager.ts:628-633)

**Per-project schema:** Partial<ReactionConfig> — all fields optional (types.ts:1120-1121)

**4 send-to-agent reactions:** ci-failed, changes-requested, bugbot-comments, merge-conflicts

**6 notify reactions:** approved-and-green, agent-stuck, agent-needs-input, agent-exited, all-complete, tracker-story-done, tracker-sprint-complete

Wait — let me recount. 11 total:
- send-to-agent: ci-failed, changes-requested, bugbot-comments, merge-conflicts = 4
- notify: approved-and-green, agent-stuck, agent-needs-input, agent-exited, all-complete, tracker-story-done, tracker-sprint-complete = 7

That's 4 + 7 = 11. Correct.

### Just the Docs Features Used

- `{: .highlight }` callout for tips and TL;DR
- Markdown tables for reaction configs, action types, trigger mappings
- `text` syntax highlighting for ASCII diagrams
- `yaml` syntax highlighting for config examples
- Relative links to sibling pages and cross-section links

### Link Verification

All internal links verified against existing pages:
- `../sessions/` → `docs/core-concepts/sessions.md` (exists, updated in Story 62-7)
- `../autopilot/` → `docs/core-concepts/autopilot.md` (exists, updated in Story 62-9)
- `../stories-sprints/` → `docs/core-concepts/stories-sprints.md` (exists, updated in Story 62-8)
- `../../getting-started/configuration/` → `docs/getting-started/configuration.md` (exists, updated in Story 62-5)

### Important: Single File Change

This story modifies **only** `docs/core-concepts/reactions-engine.md`.

### References

- [Source: packages/core/src/lifecycle-manager.ts — eventToReactionKey, executeReaction, ReactionTracker, parseDuration, tracker cleanup, special triggers]
- [Source: packages/core/src/types.ts lines 839-864 — ReactionConfig, lines 866-872 — ReactionResult, line 770 — EventPriority, lines 773-821 — EventType]
- [Source: packages/core/src/config.ts lines 25-34 — ReactionConfigSchema, lines 386-461 — applyDefaultReactions, line 244 — global schema, line 171 — per-project schema]
- [Source: packages/core/src/prompt-builder.ts lines 107-120 — Agent prompt injection]
- [Source: packages/core/src/orchestrator-prompt.ts lines 129-148 — System prompt documentation]
- [Source: packages/core/src/__tests__/lifecycle-manager.test.ts — 31+ reaction test cases]
- [Source: docs/architecture.md lines 92-110 — Reaction Layer section]
- [Source: Story 62-9 — Previous story learnings (title consistency, diagram widths, source accuracy)]
- [Source: Story 62-8 — Previous story learnings (step count accuracy, abbreviation footnotes)]
- [Source: Story 62-7 — Previous story learnings (diagram width, callouts, source accuracy)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

N/A — no issues encountered during implementation.

### Completion Notes List

- All 12 ACs verified against the written page
- ASCII diagrams verified: all text code block lines ≤ 60 chars (max: 59)
- 11 default reaction keys documented from config.ts:386-461
- 3 action types documented (send-to-agent, notify, auto-merge) from types.ts:845
- 8 ReactionConfig fields documented from types.ts:839-864
- 4 EventPriority levels documented from types.ts:770
- 11 EventType → reaction key trigger mapping from lifecycle-manager.ts:138-166
- CI Fix Flow worked example with 4-step pipeline diagram
- Review Address Flow worked example with 4-step pipeline diagram
- 3 escalation triggers documented (attempt-based, duration-based, count-based)
- Tracker lifecycle documented (created, incremented, cleared, pruned)
- Custom Configuration section with global + per-project YAML examples
- Per-project merge behavior documented: shallow merge with Partial<ReactionConfig>
- No hero-style font classes used on interior page
- Front matter title matches H1 heading (both "Reactions Engine")
- 4 navigation links verified against existing sibling pages
- `pnpm test` passes (only pre-existing standup-generator date sensitivity failure unrelated to this story)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-22 | Created story artifact from epic and source analysis | Claude Sonnet 4 |
| 2026-04-22 | Rewrote reactions-engine.md from placeholder to full production page | Claude Sonnet 4 |
| 2026-04-22 | Code review: fixed 2M + 2L issues (action/priority type accuracy, retries default, auto-merge stub note, ReactionResult docs) | Claude Sonnet 4 |

### Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 4 on 2026-04-22
**Outcome:** Approved (with fixes applied)

**Findings (all fixed):**
- [M1] `action` type in ReactionConfig table listed as `string` — changed to `"send-to-agent" | "notify" | "auto-merge"` for accuracy
- [M2] `priority` type listed as `string?` — changed to `EventPriority?` to reference the actual union type
- [L1] `auto-merge` action type has no default reaction and is currently a stub — added callout explaining this
- [L2] 5 ReactionResult fields not documented on page — added `### Reaction Result` subsection with 5-field table

**Source Verification:**
- 11 default reaction keys verified against config.ts:387-461 ✓
- 4 send-to-agent reactions verified against config.ts:389-415 ✓
- 7 notify reactions verified against config.ts:416-454 ✓
- 3 action types verified against types.ts:845 ✓
- 8 ReactionConfig fields verified against types.ts:840-864 ✓
- 4 EventPriority levels verified against types.ts:770 ✓
- 5 ReactionResult fields verified against types.ts:866-872 ✓
- 11 EventType → reaction key mappings verified against lifecycle-manager.ts:139-166 ✓
- ReactionTracker fields verified against lifecycle-manager.ts:174-178 ✓
- Default poll interval 30,000ms verified against lifecycle-manager.ts:823 ✓
- Default auto: true verified against config.ts:26 ✓
- Default action: "notify" verified against config.ts:27 ✓
- Default retries: Infinity verified against lifecycle-manager.ts:361 ✓
- parseDuration units (s/m/h) verified against lifecycle-manager.ts:45-59 ✓
- Per-project merge verified against lifecycle-manager.ts:628-633 ✓
- approved-and-green auto: false verified against config.ts:417 ✓
- ci-failed retries: 2, escalateAfter: 2 verified against config.ts:389-396 ✓
- auto-merge stub (just notifies) verified against lifecycle-manager.ts:442-458 ✓
- reaction.escalated event verified against types.ts:807 ✓
- ASCII diagrams all ≤ 60 chars verified with awk ✓

### File List

- `docs/core-concepts/reactions-engine.md` — rewritten from placeholder to full production page (~250 lines)
