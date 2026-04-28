# Story 62.58: Tutorial — Custom Workflow

Status: done

## Story

As a developer using the Agent Orchestrator,
I want a step-by-step tutorial that walks me through building a custom workflow — configuring reactions, adding custom hooks, layering prompt rules, setting up the verification gate, and wiring everything together for production use,
so that I can create tailored automation pipelines that match my team's specific development workflow.

## Acceptance Criteria

1. **Custom Workflow tutorial** (`docs/tutorials/custom-workflow.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Custom Workflow`, `nav_order: 5`, `parent: Tutorials`, `description` field
2. **Prerequisites section** assumes completion of "Multi-Agent Sprint" tutorial or equivalent multi-project setup — links to Multi-Agent Sprint tutorial and Configuration doc
3. **Overview section** introduces the custom workflow model: reactions pipeline, hooks system, prompt layers, verification gate — links to Reactions Engine, Hooks & Extensions, Prompt Layers, Verification Gate docs
4. **Step 1 (Configure Reactions) section** documents reaction configuration (ReactionConfig with 8 fields), default reactions (11), trigger mapping, action types (send-to-agent, notify, auto-merge), escalation — with YAML examples for global and per-project overrides
5. **Step 2 (Custom Reaction) section** documents creating a custom reaction from scratch — defining trigger, action, message, retries, escalation, testing via `ao send` — with YAML examples and copy-pasteable commands
6. **Step 3 (Add Custom Hooks) section** documents the hook system (preCompact/postCompact phases), HookRegistry, 3 built-in hooks, 5 profiles by StoryType, custom hook registration pattern — with TypeScript code examples for PreCompactHook and PostCompactHook
7. **Step 4 (Layer Prompt Rules) section** documents the 5-layer prompt composition (Base, Config, Rules, Learnings, Memory), agentRules/agentRulesFile config, CLAUDE.md merge — with YAML examples showing each layer
8. **Step 5 (Set Up Verification Gate) section** documents verification config (enabled, checks[], onFailure, retry, persistent), 4 check types, auto-retry, persistent execution — with YAML examples
9. **Step 6 (Wire Everything Together) section** documents combining reactions, hooks, prompt rules, and verification into a complete custom workflow — with a full `agent-orchestrator.yaml` example
10. **Step 7 (Troubleshooting) section** covers common custom workflow issues: reaction not firing, hooks failing silently, prompt rules not injected, verification blocking completion, custom hook error taking down session — with solutions
11. **Next Steps section** links to: Reactions Engine, Hooks & Extensions, Prompt Layers, Verification Gate, Configuration, Custom Plugin Development, CLI Reference
12. **Every command is copy-pasteable** with expected output shown after each command block
13. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
14. **Cross-links** verified: parent link to Tutorials index, sibling links to other tutorial pages, links to Reactions Engine, Hooks & Extensions, Prompt Layers, Verification Gate, Configuration, Sessions, CLI Reference
15. **Front matter** includes `description` field
16. **Callouts** use Just the Docs callout syntax (`{: .highlight }` for highlight, `{: .note}` for notes, `{: .warning}` for warnings)

## Tasks / Subtasks

- [x] Task 1: Write Custom Workflow tutorial (AC: #1-16)
  - [x] Replace stub content in docs/tutorials/custom-workflow.md
  - [x] Write front matter (title, nav_order: 5, parent: Tutorials, description) (AC #1, #15)
  - [x] Write "Prerequisites" section — links to Multi-Agent Sprint and Configuration (AC #2)
  - [x] Write "Overview" section — custom workflow model, 4 pillars (reactions, hooks, prompts, verification) (AC #3)
  - [x] Write "Step 1: Configure Reactions" section — ReactionConfig, 11 defaults, triggers, actions, escalation (AC #4)
  - [x] Write "Step 2: Create a Custom Reaction" section — custom reaction from scratch with YAML and ao send (AC #5)
  - [x] Write "Step 3: Add Custom Hooks" section — hook registry, built-in hooks, profiles, custom registration (AC #6)
  - [x] Write "Step 4: Layer Prompt Rules" section — 5-layer composition, agentRules, CLAUDE.md merge (AC #7)
  - [x] Write "Step 5: Set Up Verification Gate" section — checks, auto-retry, persistent execution (AC #8)
  - [x] Write "Step 6: Wire Everything Together" section — full config combining all components (AC #9)
  - [x] Write "Step 7: Troubleshooting" section — common custom workflow issues with solutions (AC #10)
  - [x] Write "Next Steps" section — links to related docs (AC #11)
  - [x] Verify all commands are copy-pasteable with expected output (AC #12)
  - [x] Verify no hero font classes (AC #13)
  - [x] Verify cross-links resolve (AC #14)
  - [x] Verify callouts use Just the Docs syntax (AC #16)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/tutorials/custom-workflow.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All commands match actual CLI command syntax
- Expected output examples are realistic
- Cross-links resolve to existing pages
- No hero font classes used
- Tutorial reads as a complete walkthrough

## Dev Notes

### Architecture Patterns (from Story 62-48 through 62-57 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Tutorials index, sibling links to each tutorial page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- This is a **tutorial page** — focus on step-by-step walkthrough with copy-pasteable commands
- Use Just the Docs callout syntax: `{: .highlight }`, `{: .note }`, `{: .warning }`
- From 62-51/62-52/62-53/62-54/62-55/62-56/62-57 reviews: verify all behavioral claims against actual source code
- Mark fabricated/representative output blocks clearly

### Source Tree — Reactions Engine (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/core-concepts/reactions-engine.md` | 11 reactions, 3 action types, ReactionConfig (8 fields), trigger mapping, escalation, per-project overrides | `docs/core-concepts/` |

### Source Tree — Hooks & Extensions (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/advanced/hooks-extensions.md` | preCompact/postCompact hooks, HookRegistry, 3 built-in hooks, 5 profiles by StoryType, custom hook registration | `docs/advanced/` |

### Source Tree — Prompt Layers (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/advanced/prompt-layers.md` | 5-layer prompt composition, CLAUDE.md merge, agentRules/agentRulesFile, delivery mechanisms | `docs/advanced/` |

### Source Tree — Verification Gate (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/core-concepts/verification-gate.md` | 4 check types, auto-retry, persistent execution, VerificationConfig, failure behavior | `docs/core-concepts/` |

### Source Tree — Configuration (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/getting-started/configuration.md` | Reactions config, notifiers, verification gate, per-project overrides | `docs/getting-started/` |

### Source Tree — Session Commands (1 file)

| File | Purpose | Source |
|------|---------|--------|
| `docs/cli/session-commands.md` | ao send (busy detection, retry, file delivery) | `docs/cli/` |

### Key Custom Workflow Concepts for Tutorial

#### Reaction Trigger Mapping (from reactions-engine.md)

| Event Type | Reaction Key | Auto |
|------------|-------------|------|
| `ci.failing` | `ci-failed` | yes |
| `review.changes_requested` | `changes-requested` | yes |
| `automated_review.found` | `bugbot-comments` | yes |
| `merge.conflicts` | `merge-conflicts` | yes |
| `merge.ready` | `approved-and-green` | no |
| `session.stuck` | `agent-stuck` | yes |
| `session.needs_input` | `agent-needs-input` | yes |
| `session.killed` | `agent-exited` | yes |
| `summary.all_complete` | `all-complete` | yes |
| `tracker.story_done` | `tracker-story-done` | yes |
| `tracker.sprint_complete` | `tracker-sprint-complete` | yes |

#### ReactionConfig Fields (from reactions-engine.md)

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | `true` = execute automatically, `false` = notify only |
| `action` | `"send-to-agent" \| "notify" \| "auto-merge"` | What the reaction does when triggered |
| `message` | string? | Text sent to the agent (for `send-to-agent` actions) |
| `priority` | `EventPriority?` | Notification priority: `urgent`, `action`, `warning`, `info` |
| `retries` | number? | Max non-escalating attempts (default: unlimited) |
| `escalateAfter` | number or string? | Escalation threshold (attempts or duration) |
| `threshold` | string? | Duration before triggering (e.g., `"10m"`) |
| `includeSummary` | boolean? | Include session summary in notification |

#### Action Types (from reactions-engine.md)

| Action | Description |
|--------|-------------|
| `send-to-agent` | Sends `message` text to the agent session |
| `notify` | Sends a notification to humans via configured notifiers |
| `auto-merge` | Triggers auto-merge via SCM plugin |

#### Hook Phases (from hooks-extensions.md)

| Phase | When | Purpose |
|-------|------|---------|
| `preCompact` | Before compaction | Save working state to persistent storage |
| `postCompact` | After compaction | Read saved state and return context for re-injection |

#### HookRegistry Methods (from hooks-extensions.md)

| Method | Purpose |
|--------|---------|
| `register(phase, name, hook)` | Add a named hook to a phase |
| `runPreCompact(worktreePath, sessionMetadata)` | Execute all pre-compact hooks in registration order |
| `runPostCompact(worktreePath)` | Execute all post-compact hooks, return concatenated context |

#### Built-in Hooks (from hooks-extensions.md)

| Hook | Phase | Purpose |
|------|-------|---------|
| `notepad` | preCompact | Saves task state to notepad Working Memory section |
| `notepad` | postCompact | Reads notepad and returns formatted context for re-injection |
| `projectMemory` | preCompact | Merges learnings into project-memory.json (first-write wins) |

#### Hook Profiles by StoryType (from hooks-extensions.md)

| StoryType | Phases | Enabled Hooks | Use Case |
|-----------|--------|---------------|----------|
| `exploration` | preCompact | notepad | Spikes, research — save state only |
| `implementation` | preCompact, postCompact | notepad, projectMemory | Feature work — full survival |
| `bugfix` | preCompact, postCompact | notepad, projectMemory | Bug fixes — full survival |
| `review` | postCompact | notepad | Code review — restore context only |
| `default` | preCompact, postCompact | notepad, projectMemory | Unknown type — full survival |

#### Prompt Layer Architecture (from prompt-layers.md)

| Layer | Heading | Config Gate | Source |
|-------|---------|-------------|--------|
| 1. Base | (none, inline) | Always (when composing) | `prompt-builder.ts` |
| 2. Config | `## Project Context`, `## Task`, etc. | Always (when composing) | `prompt-builder.ts` |
| 3. Rules | `## Project Rules` | `project.agentRules` or `project.agentRulesFile` | `prompt-builder.ts` |
| 4. Learnings | `## Lessons from Past Sessions` | `project.learning.injectInPrompts` | `prompt-builder.ts` |
| 5. Memory | `## Cross-Session Knowledge` | `project.learning.crossSessionMemory` | `memory-bridge.ts` |

#### Verification Gate Checks (from verification-gate.md)

| Type | Typical Command | Purpose |
|------|----------------|---------|
| `test` | `pnpm test` | Run unit and integration tests |
| `lint` | `pnpm lint` | Check code style and static analysis |
| `typecheck` | `pnpm typecheck` | Verify TypeScript types |
| `custom` | Any shell command | Project-specific validation |

#### Verification Failure Behavior (from verification-gate.md)

| onFailure | Final Status | Behavior |
|-----------|-------------|----------|
| `"review"` (default) | `review` | Human notified for review |
| `"block"` | `blocked` | Requires manual intervention |

#### ao send Syntax (from session-commands.md)

```bash
ao send <session> "message text"
ao send <session> -f instructions.md
ao send <session> "message" --no-wait
ao send <session> "message" --timeout 300
```

### Common Troubleshooting Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Reaction not firing | `auto: false` or wrong reaction key | Check reactions config; verify the reaction key matches an event type |
| Hook failing silently | Hook errors are caught and logged | Check logs for `[hooks]` warnings; hook failures never block other hooks |
| Prompt rules not injected | `agentRules` not set or file missing | Verify config field name and file path relative to `project.path` |
| Verification blocking completion | `onFailure: "block"` and checks failing | Change to `onFailure: review` or fix the failing check command |
| Custom hook crashes session | Errors are isolated per-hook | Check error logs; custom hooks can't crash the compact cycle |

### Project Structure Notes

- Doc file location: `docs/tutorials/custom-workflow.md`
- Nav order: 5 (fifth child under Tutorials)
- Parent: Tutorials (`docs/tutorials/index.md`)
- Sibling pages: first-agent (1), github-ci-cd-flow (2), multi-agent-sprint (3), portfolio-management (4), custom-workflow (5)
- Current stub says "Story 62.23" — incorrect, this is Story 62-58
- This is a **tutorial page** — step-by-step walkthrough with copy-pasteable commands, NOT an API reference

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.58]
- [Source: docs/core-concepts/reactions-engine.md — 11 reactions, 3 action types, ReactionConfig, trigger mapping, escalation]
- [Source: docs/advanced/hooks-extensions.md — hook registry, built-in hooks, profiles, custom registration]
- [Source: docs/advanced/prompt-layers.md — 5-layer composition, CLAUDE.md merge, agentRules]
- [Source: docs/core-concepts/verification-gate.md — checks, auto-retry, persistent execution]
- [Source: docs/getting-started/configuration.md — reactions, verification, per-project overrides]
- [Source: docs/cli/session-commands.md — ao send with busy detection]

## Change Log

- 2026-04-28: Story created from sprint backlog
- 2026-04-28: Replaced 9-line stub in `docs/tutorials/custom-workflow.md` with comprehensive custom workflow tutorial covering reactions configuration, custom reactions, hooks system, prompt layers, verification gate, complete wiring example, and troubleshooting

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/tutorials/custom-workflow.md` stub (9 lines) with comprehensive tutorial documentation
- All 16 acceptance criteria covered across 9 sections
- Sections: Prerequisites (link to Multi-Agent Sprint + Configuration), Overview (4-pillar custom workflow model, 5-step cycle), Step 1 Configure Reactions (11 default reactions table, 8 ReactionConfig fields, global and per-project overrides with shallow merge), Step 2 Create a Custom Reaction (custom CI message example, ao send testing with 3 command variants, escalation behavior table), Step 3 Add Custom Hooks (2 hook phases, 3 built-in hooks, 5 profiles by StoryType with detection keywords, TypeScript code examples for custom PreCompactHook/PostCompactHook, registration pattern), Step 4 Layer Prompt Rules (5-layer architecture table with config gates, agentRules/agentRulesFile, learning.injectInPrompts, learning.crossSessionMemory, CLAUDE.md merge), Step 5 Set Up Verification Gate (4 check types, onFailure behavior table, auto-retry config, persistent execution config), Step 6 Wire Everything Together (full agent-orchestrator.yaml combining all 4 pillars, operational flow diagram), Troubleshooting (5 issues with solutions: reaction not firing, hooks failing silently, prompt rules not injected, verification blocking completion, custom hook errors), Next Steps (7 links + cross-links section)
- Front matter includes `description` field (was missing from stub)
- Cross-links verified: parent Tutorials, 4 sibling pages, Reactions Engine, Hooks & Extensions, Prompt Layers, Verification Gate, Configuration, Sessions, Memory & Learning, Custom Plugin Development, CLI Reference, Session Commands, Monitoring Commands, Quick Start (all 17 resolve)
- No hero font classes used
- All code blocks use correct syntax highlighting (yaml, bash, text, typescript)
- Callouts use Just the Docs syntax: `{: .highlight }` (3) and `{: .note }` (1)
- Every command is copy-pasteable with expected output shown after each block
- ReactionConfig fields verified against reactions-engine.md (auto, action, message, priority, retries, escalateAfter, threshold, includeSummary)
- 11 default reactions verified against reactions-engine.md trigger mapping table
- Hook phases, built-in hooks, and profiles verified against hooks-extensions.md
- Prompt layer architecture (5 layers with config gates) verified against prompt-layers.md
- Verification gate check types and failure behavior verified against verification-gate.md
- ao send syntax verified against session-commands.md (positional message, -f file, --no-wait, --timeout)
- Representative output blocks clearly marked
- Corrected stub reference from "Story 62.23" to Story 62-58

### File List

- `docs/tutorials/custom-workflow.md` — replaced stub with comprehensive Custom Workflow tutorial

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-28

### Review Findings

**Issues Found:** 0 HIGH, 1 MEDIUM, 1 LOW = 2 total
**Issues Fixed:** 2

#### MEDIUM Issues

1. **Hook profiles table omitted Metadata column (lines 213-219):** The source doc at `hooks-extensions.md` shows each profile has distinct metadata that differentiates behavior — e.g., `exploration` has `{ mode: "read-only" }`, `implementation` has `{ mode: "full", verify: "true" }`, `bugfix` has `{ mode: "targeted", verify: "true" }`. The tutorial dropped this column, losing useful context for readers. **Fixed** — added Metadata column with values from source doc.

#### LOW Issues

2. **Detection keywords incomplete (line 221):** Listed `spike/investigat/explor → exploration, fix/bug/patch → bugfix, review/audit → review` but omitted `research` (exploration), `hotfix` (bugfix), and `refactor` (review) from `hooks-extensions.md` detectStoryType section. **Fixed** — added all missing keywords.

### Verification Summary

- All 16 ACs verified implemented
- All 17 cross-links resolve to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting (yaml, bash, text, typescript)
- Callouts use correct Just the Docs syntax (3 highlight, 1 note)
- 11 default reactions table verified against reactions-engine.md
- ReactionConfig 8 fields verified against reactions-engine.md
- Hook profiles table (now with Metadata column) verified against hooks-extensions.md
- Detection keywords (now complete) verified against hooks-extensions.md
- Prompt layer architecture (5 layers) verified against prompt-layers.md
- Verification gate check types verified against verification-gate.md
- ao send syntax verified against session-commands.md
- Learnings filtering (3 entries, failures only, domain relevance) verified against prompt-layers.md
- Memory dedup (content hash, 10MB rotation) verified against prompt-layers.md
- Built-in hooks table verified against hooks-extensions.md (notepad: pre+post, projectMemory: pre only)
- No YAML syntax errors in config examples
- Representative output blocks clearly marked

### Outcome

**APPROVED** — Both issues fixed. Tutorial accurately documents the custom workflow system.
