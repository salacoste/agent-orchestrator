# Task Status Definitions

## Overview

This document defines the status values used throughout the BMAD workflow for stories and tasks, ensuring consistent tracking and clear understanding of what each status means.

## Story Status Lifecycle

### backlog

**Definition:** Story only exists in epic file, not yet ready for development.

**When to Use:**
- Story is planned in an epic but hasn't been created yet
- Story is waiting for prioritization

**What Happens:**
- Story exists only in epic markdown file
- No story file in implementation-artifacts folder
- Story key may exist in sprint-status.yaml with status "backlog"

**Transition To:** ready-for-dev (when story file is created via create-story workflow)

### ready-for-dev

**Definition:** Story file created with comprehensive context from epics/PRD/architecture.

**When to Use:**
- create-story workflow completes
- Story file exists in implementation-artifacts folder
- All context loaded from epics, PRD, architecture, UX docs
- Ready for developer to begin implementation

**What Happens:**
- Story file contains:
  - User story statement (As a, I want, so that)
  - Acceptance criteria (BDD format with Given/When/Then)
  - Tasks/subtasks with checkboxes
  - Dev Notes with technical requirements
  - Interface Validation section
  - References to source documents
- Story key in sprint-status.yaml updated to "ready-for-dev"

**Transition To:** in-progress (when dev-story workflow begins)

### in-progress

**Definition:** Developer actively working on implementation.

**When to Use:**
- dev-story workflow starts
- Developer is actively coding
- Story file is being updated with progress

**What Happens:**
- Developer implements tasks according to story
- Tasks/subtasks marked with `[-]` as work progresses
- Tests written and verified
- Story file updated with Dev Agent Record entries
- sprint-status.yaml shows "in-progress"

**Transition To:** review (when all tasks complete and dev-story workflow finishes)

### review

**Definition:** All tasks complete, ready for code review.

**When to Use:**
- dev-story workflow completes
- All tasks/subtasks marked `[x]`
- Story Status field set to "review"

**What Happens:**
- Story implementation complete
- All tests passing
- Documentation updated
- Ready for adversarial code review

**Transition To:** done (after code-review workflow passes)

### done

**Definition:** Code review passed, all findings addressed, story fully implemented.

**When to Use:**
- code-review workflow completes
- All HIGH and MEDIUM review findings fixed
- All acceptance criteria verified
- Story ready for production

**What Happens:**
- Story fully implemented and tested
- All review follow-ups resolved
- sprint-status.yaml shows "done"
- Story can be merged/deployed

**Final State:** No further work needed on this story.

## Task Status within Stories

### `[ ]` = Not Started

**Definition:** Task has not been started yet.

**When to Use:**
- Beginning implementation
- Task is pending

**Example:**
```markdown
- [ ] Implement user authentication
```

### `[-]` = Partially Complete

**Definition:** Some work done, but task is NOT 100% complete.

**When to Use:**
- Task has multiple subtasks and some are incomplete
- Task has known limitations or deferred items
- Task needs more work before completion

**Requirements:**
- MUST document what's missing
- MUST document deferred items explicitly
- Parent task MUST be `[-]` if ANY subtask is incomplete

**Example:**
```markdown
- [-] Implement user authentication
  - [x] Create login form
  - [x] Add password validation
  - [ ] Handle OAuth integration (deferred - requires GitHub app setup)
  - [ ] Add session management (deferred - requires Redis)
```

### `[x]` = 100% Complete

**Definition:** Task is completely finished with all requirements met.

**When to Use:**
- ONLY when task is truly 100% complete

**Requirements:**
- All acceptance criteria met
- All tests passing (with real assertions, not placeholders)
- All documentation updated
- No hidden TODOs or deferred items
- No placeholder code

**Example:**
```markdown
- [x] Create login form
  - [x] Add email field
  - [x] Add password field
  - [x] Add submit button
  - [x] Style with Tailwind CSS
  - [x] Add form validation
  - [x] Write unit tests (5 tests, all passing)
  - [x] Add accessibility labels
```

## Common Patterns and Anti-Patterns

### ✅ Correct: Partial Completion with Clear Documentation

```markdown
- [-] Implement data synchronization
  - [x] Create sync() function
  - [x] Add retry logic for failed syncs
  - [ ] Add conflict resolution (deferred - requires distributed locking)
    - Status: Deferred - Requires Redis or etcd for distributed locks
    - Epic: Story 2-5 - State Manager Write-Through Cache
    - Current: Basic retry only, conflicts will be logged
```

### ❌ Wrong: Partial Completion Marked as Complete

```markdown
- [x] Implement data synchronization
  - [x] Create sync() function
  - [x] Add retry logic
  - [ ] TODO: Add conflict resolution later
```

**Problems:**
- Task marked `[x]` but incomplete
- Hidden TODO in code
- Deferred item not explicitly tracked
- Misleading sprint status

### ✅ Correct: Deferred Items Explicitly Tracked

**In Story Dev Notes:**
```markdown
### Limitations (Deferred Items)

1. Distributed conflict resolution
   - Status: Deferred - Requires distributed locking
   - Requires: Redis or etcd
   - Epic: Story 2-5 - State Manager Write-Through Cache
   - Current: Basic retry only, conflicts logged
```

**In sprint-status.yaml:**
```yaml
limitations:
  distributed-conflict-resolution: "Story 2-5 - State Manager Write-Through Cache"
```

### ❌ Wrong: Deferred Items Not Clearly Tracked

```markdown
- [x] Implement data synchronization
  - Deferred: Conflict resolution
  - Deferred: Session management
```

**Problems:**
- Deferred items not marked with `[ ]`
- No clear status on what's deferred vs what's done
- No documentation of why items are deferred
- No tracking in sprint-status.yaml

## Status Transition Rules

### Valid Transitions

```
backlog → ready-for-dev → in-progress → review → done
```

### Invalid Transitions

```
❌ backlog → in-progress (skip ready-for-dev)
❌ ready-for-dev → review (skip implementation)
❌ in-progress → done (skip code review)
❌ review → backlog (reverse flow)
```

### When to Use Each Status

**backlog:**
- Story is in planning phase
- Epic created but story not yet created

**ready-for-dev:**
- Story file created with full context
- Ready to be picked up by developer
- Waiting in sprint queue

**in-progress:**
- Developer actively implementing
- Story file being updated
- Tasks being checked off

**review:**
- Implementation complete
- All tasks marked `[x]`
- Ready for adversarial code review

**done:**
- Code review passed
- All findings addressed
- Story fully complete

## Sprint Status Tracking

The sprint-status.yaml file tracks story status for the entire project:

```yaml
development_status:
  epic-1: done
  1-1-cli-generate-sprint-plan-from-yaml: done
  1-2-cli-spawn-agent-with-story-context: done
  1-3-state-track-agent-assignments: in-progress
   2-1-3-task-completion-validation: ready-for-dev
```

**Status Values:**
- `backlog` - Story in epic only
- `ready-for-dev` - Story file created, ready for dev
- `in-progress` - Developer working on story
- `review` - Ready for code review
- `done` - Story complete

## Quick Reference

| Status | Symbol | When | Requirements |
|--------|--------|------|------------|
| Not started | `[ ]` | Task not started | Nothing done yet |
| Partial | `[-]` | Task in progress | Some work done, document what's missing |
| Complete | `[x]` | Task finished | 100% done: all ACs met, tests passing, documented |

**Remember:** `[x]` is ONLY for 100% complete. Use `[-]` for partial work and always document what's missing.
