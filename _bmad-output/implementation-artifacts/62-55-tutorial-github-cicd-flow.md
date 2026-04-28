# Story 62.55: Tutorial — GitHub CI/CD Flow

Status: done

## Story

As a developer using the Agent Orchestrator with GitHub,
I want a step-by-step tutorial that walks me through configuring auto-reactions for CI failures, review comments, and merge conflicts, setting up notifications, and monitoring the full CI/CD lifecycle from PR creation to merge,
so that I can automate the entire review-and-merge loop and only intervene when human judgment is required.

## Acceptance Criteria

1. **GitHub CI/CD Flow tutorial** (`docs/tutorials/github-ci-cd-flow.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: GitHub CI/CD Flow`, `nav_order: 2`, `parent: Tutorials`, `description` field
2. **Prerequisites section** assumes completion of "Your First Agent" tutorial or equivalent setup — links to first-agent tutorial and Installation doc
3. **Overview section** introduces the CI/CD automation model: reactions engine, 5-step status determination, polling interval (30s), event-to-reaction mapping — links to Reactions Engine and Sessions docs
4. **Step 1 (Configure Reactions) section** documents default reactions config with YAML example, explains the 4 auto-fix reactions (ci-failed, changes-requested, bugbot-comments, merge-conflicts) and 7 notify reactions — with config fields table (auto, action, message, retries, escalateAfter, threshold, priority, includeSummary)
5. **Step 2 (Set Up Notifications) section** documents notification routing (urgent/action/warning/info), notifier configuration examples (desktop, Slack, Telegram), and environment variable setup — sourced from configuration.md
6. **Step 3 (Spawn and Watch CI) section** documents spawning an agent, watching CI status via `ao status` (10-column table with CI/Rev columns), `ao logs --follow`, and `ao events query --type ci.failing` — with copy-pasteable commands and expected output
7. **Step 4 (CI Failure Auto-Fix) section** documents the ci-failed reaction flow step-by-step (CI fails → event detected → message sent to agent → agent fixes → retry or escalate), with state diagram (ci_failed → working → pr_open) and escalation threshold explanation
8. **Step 5 (Review Auto-Address) section** documents the changes-requested reaction flow step-by-step (reviewer requests changes → event detected → review comments forwarded to agent → agent addresses → push fixes), with escalation timeout (30 min)
9. **Step 6 (Merge and Complete) section** documents the approved-and-green reaction (default: notify, can configure auto-merge), merge flow (mergeable → merged), tracker-story-done notification, and all-complete event — includes auto-merge config example
10. **Step 7 (Per-Project Overrides) section** documents per-project reaction overrides (shallow merge), verification gate (test/lint/typecheck checks), and per-project notification routing — with YAML examples
11. **Step 8 (Monitor with Events) section** documents `ao events query` for CI/CD event audit trail, `ao events status` for queue health, `ao fleet --watch` for fleet monitoring — with command examples
12. **Troubleshooting section** covers common CI/CD issues: agent stuck in ci_failed loop, reaction not firing, notification not delivered, event bus degraded, merge conflicts unresolved — with solutions
13. **Next Steps section** links to: Reactions Engine, Configuration, Multi-Agent Sprint tutorial, Sessions, CLI Reference
14. **Every command is copy-pasteable** with expected output shown after each command block
15. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
16. **Cross-links** verified: parent link to Tutorials index, sibling links to other tutorial pages, links to Reactions Engine, Configuration, Sessions, CLI Reference, First Agent tutorial
17. **Front matter** includes `description` field
18. **Callouts** use Just the Docs callout syntax (`{: .highlight }` for highlight, `{: .note}` for notes, `{: .warning}` for warnings)

## Tasks / Subtasks

- [x] Task 1: Write GitHub CI/CD Flow tutorial (AC: #1-18)
  - [x] Replace stub content in docs/tutorials/github-ci-cd-flow.md
  - [x] Write front matter (title, nav_order: 2, parent: Tutorials, description) (AC #1, #17)
  - [x] Write "Prerequisites" section — links to First Agent tutorial (AC #2)
  - [x] Write "Overview" section — reactions model, status determination, event mapping (AC #3)
  - [x] Write "Step 1: Configure Reactions" section — default reactions, 4 auto-fix + 7 notify, config fields table (AC #4)
  - [x] Write "Step 2: Set Up Notifications" section — routing, notifiers, env vars (AC #5)
  - [x] Write "Step 3: Spawn and Watch CI" section — ao status, ao logs, ao events with expected output (AC #6)
  - [x] Write "Step 4: CI Failure Auto-Fix" section — ci-failed flow, state diagram, escalation (AC #7)
  - [x] Write "Step 5: Review Auto-Address" section — changes-requested flow, escalation timeout (AC #8)
  - [x] Write "Step 6: Merge and Complete" section — approved-and-green, auto-merge, tracker events (AC #9)
  - [x] Write "Step 7: Per-Project Overrides" section — project reactions, verification gate (AC #10)
  - [x] Write "Step 8: Monitor with Events" section — events query, status, fleet (AC #11)
  - [x] Write "Troubleshooting" section — common CI/CD issues with solutions (AC #12)
  - [x] Write "Next Steps" section — links to related docs (AC #13)
  - [x] Verify all commands are copy-pasteable with expected output (AC #14)
  - [x] Write cross-links section (AC #16)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #15)
  - [x] Verify callouts use Just the Docs syntax (AC #18)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/tutorials/github-ci-cd-flow.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All commands match actual CLI command syntax
- Expected output examples are realistic
- Cross-links resolve to existing pages
- No hero font classes used
- Tutorial reads as a complete walkthrough

## Dev Notes

### Architecture Patterns (from Story 62-48 through 62-54 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Tutorials index, sibling links to each tutorial page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- This is a **tutorial page** — focus on step-by-step walkthrough with copy-pasteable commands
- Use Just the Docs callout syntax: `{: .highlight }`, `{: .note}`, `{: .warning}`
- From 62-51/62-52/62-53/62-54 reviews: verify all behavioral claims against actual source code
- From 62-54 review: ao status has 10 columns (Session, Branch, Story, AgentSt, PR, CI, Rev, Thr, Activity, Age)
- Mark fabricated/representative output blocks clearly

### Source Tree — Reactions Engine (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/core-concepts/reactions-engine.md` | 11 reactions, trigger mapping, action types, escalation | `docs/core-concepts/` |

### Source Tree — Sessions Lifecycle (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/core-concepts/sessions.md` | 18 states, 5-step status determination, state-to-event mapping | `docs/core-concepts/` |

### Source Tree — Configuration (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/getting-started/configuration.md` | Reactions config, notification routing, verification gate | `docs/getting-started/` |

### Source Tree — CLI Commands (2 files)

| File | Purpose | Source |
|------|---------|--------|
| `docs/cli/monitoring.md` | ao status (10 columns), ao logs, ao events query, ao fleet | `docs/cli/` |
| `docs/cli/session-commands.md` | ao send (manual reaction), ao pause/resume, ao session cleanup | `docs/cli/` |

### Source Tree — Config Template (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `agent-orchestrator.yaml.example` | Reactions, notification routing, verification gate examples | Root |

### Key CI/CD Concepts for Tutorial

#### 4 Auto-Fix Reactions (send-to-agent)

| Reaction | Trigger Event | Retries | Escalate After |
|----------|---------------|---------|----------------|
| `ci-failed` | `ci.failing` | 2 | 2 attempts |
| `changes-requested` | `review.changes_requested` | unlimited | 30 min |
| `bugbot-comments` | `automated_review.found` | unlimited | 30 min |
| `merge-conflicts` | `merge.conflicts` | unlimited | 15 min |

#### 7 Notify Reactions

| Reaction | Trigger Event | Priority |
|----------|---------------|----------|
| `approved-and-green` | `merge.ready` | action (auto: false) |
| `agent-stuck` | `session.stuck` | urgent |
| `agent-needs-input` | `session.needs_input` | urgent |
| `agent-exited` | `session.killed` | urgent |
| `all-complete` | `summary.all_complete` | info |
| `tracker-story-done` | `tracker.story_done` | info |
| `tracker-sprint-complete` | `tracker.sprint_complete` | action |

#### CI/CD State Flow Diagram

```
working → pr_open → review_pending → approved → mergeable → merged
              │           │
              ├── ci_failed ──→ working (auto-fix, up to 2 retries)
              │
              └── changes_requested ──→ working (auto-address, 30 min timeout)
```

#### Reaction Config Fields (8 fields)

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | true = execute automatically |
| `action` | string | send-to-agent, notify, auto-merge |
| `message` | string? | Text sent to the agent |
| `priority` | string? | urgent, action, warning, info |
| `retries` | number? | Max non-escalating attempts |
| `escalateAfter` | number/string? | Escalation threshold |
| `threshold` | string? | Duration before triggering |
| `includeSummary` | boolean? | Include session summary |

#### Notification Routing Levels

| Level | Default Channels | Use Case |
|-------|------------------|----------|
| `urgent` | desktop, composio | Agent stuck, needs input, errored |
| `action` | desktop, composio | PR ready to merge |
| `warning` | composio | Auto-fix failed |
| `info` | composio | Summary, all done |

### Key CLI Commands for Tutorial

| Step | Command | Purpose | Source |
|------|---------|---------|--------|
| Monitor | `ao status` | Show all sessions with CI/Rev columns | `monitoring.md` |
| Monitor | `ao logs <session> --follow` | Stream agent logs live | `monitoring.md` |
| Monitor | `ao events query --type ci.failing` | Filter CI failure events | `monitoring.md` |
| Monitor | `ao fleet --watch` | Fleet status auto-refresh | `monitoring.md` |
| Manual | `ao send <session> "Fix the failing test"` | Manual message to agent | `session-commands.md` |
| Manual | `ao session cleanup --dry-run` | Preview session cleanup | `session-commands.md` |

### Verification Gate Config (from configuration.md)

```yaml
verification:
  enabled: true
  checks:
    - type: test
      command: "pnpm test"
      required: true
    - type: lint
      command: "pnpm lint"
      required: true
  onFailure: review
  retry:
    enabled: true
    maxAttempts: 2
```

### Project Structure Notes

- Doc file location: `docs/tutorials/github-ci-cd-flow.md`
- Nav order: 2 (second child under Tutorials)
- Parent: Tutorials (`docs/tutorials/index.md`)
- Sibling pages: first-agent (1), github-ci-cd-flow (2), multi-agent-sprint (3), portfolio-management (4), custom-workflow (5)
- Current stub says "Story 62.23" — incorrect, this is Story 62-55
- This is a **tutorial page** — step-by-step walkthrough with copy-pasteable commands, NOT an API reference

### Common Troubleshooting Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Agent stuck in ci_failed loop | CI fix not working after retries | Check `ao logs` for fix attempts; `ao send` with manual instructions |
| Reaction not firing | Config typo or missing reaction key | Verify reaction key matches event type exactly |
| Notification not delivered | Webhook URL invalid or notifier misconfigured | Test notifier with `ao events status` |
| Event bus degraded | Redis connection lost (multi-instance) | `ao events drain --force` to replay queued events |
| Merge conflicts unresolved | Agent can't resolve complex conflict | Check `ao logs`; resolve manually and push |

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.55]
- [Source: docs/core-concepts/reactions-engine.md — 11 reactions, trigger mapping, escalation]
- [Source: docs/core-concepts/sessions.md — 18 states, 5-step status determination, state-to-event mapping]
- [Source: docs/getting-started/configuration.md — reactions, notification routing, verification gate]
- [Source: docs/cli/monitoring.md — ao status, ao logs, ao events query, ao fleet]
- [Source: docs/cli/session-commands.md — ao send, ao pause/resume, ao session cleanup]
- [Source: agent-orchestrator.yaml.example — reactions, notification config templates]

## Change Log

- 2026-04-27: Story created from sprint backlog
- 2026-04-27: Replaced 9-line stub in `docs/tutorials/github-ci-cd-flow.md` with comprehensive CI/CD flow tutorial covering reactions configuration, notifications, CI auto-fix, review auto-address, merge completion, per-project overrides, event monitoring, and troubleshooting

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/tutorials/github-ci-cd-flow.md` stub (9 lines) with comprehensive tutorial documentation
- All 18 acceptance criteria covered across 10 sections
- Sections: Prerequisites (link to First Agent), Overview (reactions model, state diagram), Step 1 Configure Reactions (11 reactions, config fields table, 4 auto-fix + 7 notify tables), Step 2 Set Up Notifications (routing, Slack, Telegram, env vars), Step 3 Spawn and Watch CI (ao status 10-column table, ao logs, ao events), Step 4 CI Failure Auto-Fix (ci-failed flow diagram, escalation, manual intervention), Step 5 Review Auto-Address (changes-requested flow, merge-conflicts), Step 6 Merge and Complete (approved-and-green, auto-merge config, completion events), Step 7 Per-Project Overrides (shallow merge, verification gate, per-project routing), Step 8 Monitor with Events (ao events query, status, fleet), Troubleshooting (5 issues with solutions), Next Steps (6 links)
- Front matter includes `description` field (was missing from stub)
- Cross-links verified: parent Tutorials, 4 sibling pages, Reactions Engine, Configuration, Quick Start, Sessions, CLI Reference, Plugins (all 11 resolve)
- No hero font classes used
- All code blocks use correct syntax highlighting (yaml, bash, text)
- Callouts use Just the Docs syntax: `{: .highlight }` (2) and `{: .note }` (3) and `{: .warning }` (2)
- Every command is copy-pasteable with expected output shown after each block
- ao status output shows correct 10-column layout from monitoring.md
- Representative output blocks clearly marked
- Commands verified against CLI reference docs: ao status, ao logs, ao events query, ao send, ao fleet, ao events status, ao events drain
- Corrected stub reference from "Story 62.23" to Story 62-55
- CI/CD behavioral claims verified against reactions-engine.md, sessions.md, configuration.md

### File List

- `docs/tutorials/github-ci-cd-flow.md` — replaced stub with comprehensive GitHub CI/CD Flow tutorial

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-28

### Review Findings

**Issues Found:** 0 HIGH, 1 MEDIUM, 2 LOW = 3 total
**Issues Fixed:** 3

#### MEDIUM Issues

1. **State diagram showed `changes_requested` branching from wrong state**: The ASCII diagram had both `ci_failed` and `changes_requested` branching from a single vertical connector passing through both `pr_open` and `review_pending`. Per `sessions.md`, `ci_failed` transitions from `pr_open` (CI fails before review) but `changes_requested` transitions from `review_pending` (reviewer requests changes during review). **Fixed** — restructured diagram to clearly show `ci_failed` branching from `pr_open` and `changes_requested` branching from `review_pending` on separate lines.

#### LOW Issues

2. **Rev column legend said `pending` but output showed `pend`**: Line 262 described Rev values as `pending` but the actual `ao status` output (line 332) showed `pend`. **Fixed** — updated column legend to use `pend` matching actual CLI output.

3. **`ao send` examples used short session ID without clarity**: Lines 351 and 609 used `ao send abc123def` with the session ID prefix, but `session-commands.md` documents the format as `ao send <full-agent-id> "message"`. **Fixed** — added parenthetical note `(use session ID or full agent name)` to both `ao send` examples to clarify that either format works.

### Verification Summary

- All 18 ACs verified implemented
- All 11 cross-links resolve to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting
- Callouts use correct Just the Docs syntax
- ao status output shows correct 10-column layout
- State diagram now correctly shows transitions from appropriate states
- Rev column values match actual CLI output
- Representative output blocks clearly marked
- CI/CD behavioral claims verified against reactions-engine.md, sessions.md, configuration.md

### Outcome

**APPROVED** — All 3 issues fixed. Tutorial accurately documents the CI/CD automation flow.
