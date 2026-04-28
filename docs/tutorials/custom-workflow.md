---
title: Custom Workflow
nav_order: 5
parent: Tutorials
description: Step-by-step tutorial for building a custom workflow — configure reactions, add custom hooks, layer prompt rules, set up verification gates, and wire everything together for production use.
---

# Custom Workflow

This tutorial walks you through building a custom workflow — configuring reactions to automate event handling, adding hooks for compaction survival, layering prompt rules to guide agent behavior, and setting up verification gates for quality enforcement. By the end, you'll have a tailored automation pipeline that matches your team's specific development workflow.

{: .highlight }
> **Prerequisites:** Complete [Multi-Agent Sprint](multi-agent-sprint/) first, or have the orchestrator running with at least one project configured. You need `ao` CLI, a project with active stories, and familiarity with `agent-orchestrator.yaml`. See [Configuration](../getting-started/configuration/) for the full config reference.

---

## Overview

A **custom workflow** combines four pillars of the Agent Orchestrator:

1. **Reactions** — automatic responses to session events (CI failure, review comments, merge conflicts)
2. **Hooks** — compaction survival callbacks that save and restore agent context
3. **Prompt layers** — structured context injection that guides agent behavior
4. **Verification gate** — quality checks that run before marking a story complete

The custom workflow follows this cycle:

1. **React** — configure reactions for your team's event handling preferences
2. **Survive** — add hooks to persist state across context compactions
3. **Guide** — layer prompt rules to give agents the right instructions
4. **Verify** — enforce quality checks before story completion
5. **Wire** — combine everything into a unified configuration

{: .note }
> Each pillar operates independently — you can adopt them incrementally. Reactions work without hooks, hooks work without verification, and so on. See [Reactions Engine](../core-concepts/reactions-engine/), [Hooks & Extensions](../advanced/hooks-extensions/), [Prompt Layers](../advanced/prompt-layers/), and [Verification Gate](../core-concepts/verification-gate/) for the full references.

---

## Step 1: Configure Reactions

Reactions are automatic responses to events during an agent session. The orchestrator watches for triggers and either handles them automatically or notifies you.

### Default Reactions

The engine ships with **11 preconfigured reactions**:

| Reaction | Auto | Action | Trigger |
|----------|------|--------|---------|
| `ci-failed` | true | send-to-agent | CI build fails |
| `changes-requested` | true | send-to-agent | Reviewer requests changes |
| `bugbot-comments` | true | send-to-agent | Automated review comments |
| `merge-conflicts` | true | send-to-agent | Branch has merge conflicts |
| `approved-and-green` | false | notify | PR approved + CI green |
| `agent-stuck` | true | notify | Agent inactive beyond threshold |
| `agent-needs-input` | true | notify | Agent requires human decision |
| `agent-exited` | true | notify | Agent process terminated |
| `all-complete` | true | notify | All sessions finished |
| `tracker-story-done` | true | notify | Story marked complete |
| `tracker-sprint-complete` | true | notify | Sprint finished |

### Reaction Configuration

Each reaction has **8 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `auto` | boolean | `true` = execute automatically, `false` = notify only |
| `action` | `send-to-agent` \| `notify` \| `auto-merge` | What the reaction does |
| `message` | string? | Text sent to the agent |
| `priority` | `urgent` \| `action` \| `warning` \| `info` | Notification priority |
| `retries` | number? | Max non-escalating attempts |
| `escalateAfter` | number or string? | Escalation threshold (attempts or duration like `"30m"`) |
| `threshold` | string? | Duration before triggering (e.g., `"10m"`) |
| `includeSummary` | boolean? | Include session summary in notification |

### Override Global Reactions

```yaml
# Global reaction overrides
reactions:
  approved-and-green:
    auto: true              # Enable auto-merge globally
    action: auto-merge

  agent-stuck:
    auto: true
    action: notify
    priority: urgent
    threshold: "15m"        # Shorter threshold for faster alerts
```

### Override Per-Project

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    reactions:
      ci-failed:
        retries: 3              # More retries for this project
        escalateAfter: 3
      changes-requested:
        escalateAfter: "1h"     # More time for complex reviews
      agent-stuck:
        threshold: "20m"        # Longer stuck threshold
```

Per-project overrides use **shallow merge**: you only need to specify the fields you want to change. Unspecified fields inherit from the global config.

{: .highlight }
> The lifecycle manager polls every **30 seconds**. State changes appear within 30 seconds of detection. See [Reactions Engine](../core-concepts/reactions-engine/) for the full trigger mapping and escalation behavior.

---

## Step 2: Create a Custom Reaction

Beyond overriding defaults, you can define entirely new reactions for custom events. This is useful when your project has specific quality gates or notification requirements.

### Example: Slack Notification on Sprint Complete

```yaml
reactions:
  tracker-sprint-complete:
    auto: true
    action: notify
    priority: action
    includeSummary: true
```

### Example: Custom CI Message

Override the default CI failure message to include project-specific instructions:

```yaml
reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    message: |
      CI is failing on your PR. Steps to debug:
      1. Run `gh pr checks` to see which checks failed
      2. Run `pnpm test` locally to reproduce
      3. Fix the failing tests and push again
    retries: 3
    escalateAfter: 3
```

### Test a Reaction with ao send

Use `ao send` to manually deliver a message to a session and verify the reaction pipeline:

```bash
# Send a message to test agent handling
ao send my-app-62-58-tutorial "CI is failing on your PR. Run gh pr checks for details."
```

Expected output:

```text
Delivering message to my-app-62-58-tutorial...
Message delivered successfully.
```

```bash
# Send from a file (useful for complex instructions)
ao send my-app-62-58-tutorial -f ci-fix-instructions.md
```

```bash
# Send without waiting for idle
ao send my-app-62-58-tutorial "Quick note" --no-wait
```

### Escalation Behavior

Reactions track execution state per session using a `ReactionTracker`. Escalation triggers when:

| Trigger | Config | Example |
|---------|--------|---------|
| **Attempt-based** | `retries` + `escalateAfter` (number) | `retries: 2`, `escalateAfter: 2` → escalate after 2 failed attempts |
| **Duration-based** | `escalateAfter` (string) | `"30m"` → escalate after 30 minutes |

On escalation, the engine emits a `reaction.escalated` event and notifies the human at `urgent` priority.

---

## Step 3: Add Custom Hooks

Hooks are lifecycle callbacks that execute around context compaction events. When an LLM provider truncates the conversation, hooks save working state to persistent storage and reload it afterward.

### Hook Phases

| Phase | When | Purpose |
|-------|------|---------|
| `preCompact` | Before compaction | Save working state to persistent storage |
| `postCompact` | After compaction | Read saved state and return context for re-injection |

### Built-in Hooks

Three hooks are registered by default in every session:

| Hook | Phase | Purpose |
|------|-------|---------|
| `notepad` | preCompact | Saves task state to notepad Working Memory section |
| `notepad` | postCompact | Reads notepad and returns formatted context for re-injection |
| `projectMemory` | preCompact | Merges learnings into project-memory.json (first-write wins) |

### Hook Profiles by Story Type

The system auto-detects the story type and selects a matching hook profile:

| StoryType | Phases | Enabled Hooks | Metadata | Use Case |
|-----------|--------|---------------|----------|----------|
| `exploration` | preCompact | notepad | `{ mode: "read-only" }` | Spikes, research |
| `implementation` | preCompact, postCompact | notepad, projectMemory | `{ mode: "full", verify: "true" }` | Feature work |
| `bugfix` | preCompact, postCompact | notepad, projectMemory | `{ mode: "targeted", verify: "true" }` | Bug fixes |
| `review` | postCompact | notepad | `{ mode: "read-only" }` | Code review |
| `default` | preCompact, postCompact | notepad, projectMemory | `{}` | Unknown type |

Detection uses keyword heuristics: `spike`/`investigat`/`explor`/`research` → exploration, `fix`/`bug`/`patch`/`hotfix` → bugfix, `review`/`audit`/`refactor` → review.

### Configure Hook Profiles

Override the auto-detected profile in your config:

```yaml
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append
  hookProfile:
    phases:
      - preCompact
      - postCompact
    enabledHooks:
      - notepad
      - projectMemory
    metadata:
      mode: full
      verify: "true"
```

### Write a Custom Hook

Custom hooks are TypeScript functions registered on the `HookRegistry`. Here is a hook that saves open TODOs before compaction and restores them after:

```typescript
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PreCompactHook, PostCompactHook } from "@composio/ao-core";

// Save TODOs before compaction
const todoPreCompact: PreCompactHook = async (worktreePath, sessionMetadata) => {
  const todos = sessionMetadata["openTodos"];
  if (!todos) return;

  await writeFile(
    join(worktreePath, ".omc", "todos.md"),
    `# Open TODOs\n${todos.split(",").map((t) => `- ${t.trim()}`).join("\n")}\n`,
    "utf-8",
  );
};

// Restore TODOs after compaction
const todoPostCompact: PostCompactHook = async (worktreePath) => {
  try {
    const content = await readFile(
      join(worktreePath, ".omc", "todos.md"),
      "utf-8",
    );
    return `[TODO RECOVERY]\n${content}`;
  } catch {
    return ""; // File missing — nothing to restore
  }
};
```

### Register Custom Hooks

```typescript
import { createHookRegistry, registerDefaultHooks } from "@composio/ao-core";

const registry = createHookRegistry();
registerDefaultHooks(registry); // Built-in hooks first

// Add custom hooks alongside built-in ones
registry.register("preCompact", "todoSaver", todoPreCompact);
registry.register("postCompact", "todoRestorer", todoPostCompact);
```

Custom hooks run after built-in hooks. Errors are isolated — a failing custom hook never prevents built-in hooks from saving state.

{: .highlight }
> Hook failures are **caught and logged** — they never block the compact cycle. Check logs for `[hooks]` warnings if custom hooks aren't working as expected. See [Hooks & Extensions](../advanced/hooks-extensions/) for the full hook registry API and testing patterns.

---

## Step 4: Layer Prompt Rules

When the orchestrator spawns a session, it assembles a structured system prompt from **5 layers**:

| Layer | Heading | Config Gate | Purpose |
|-------|---------|-------------|---------|
| 1. Base | (inline) | Always | Foundational agent instructions |
| 2. Config | `## Project Context`, `## Task` | Always | Project name, repo, issue details |
| 3. Rules | `## Project Rules` | `agentRules` or `agentRulesFile` | Custom coding standards |
| 4. Learnings | `## Lessons from Past Sessions` | `learning.injectInPrompts` | Past failure patterns |
| 5. Memory | `## Cross-Session Knowledge` | `learning.crossSessionMemory` | Shared project knowledge |

### Add Inline Rules (Layer 3)

Inject custom coding standards into every agent prompt:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agentRules: |
      Always run tests before pushing.
      Use conventional commits (feat:, fix:, chore:).
      Never skip type checking.
      Use vitest, not jest.
```

### Load Rules from a File

For larger rule sets, load from a file instead:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agentRulesFile: ".omc/agent-rules.md"
```

Both `agentRules` and `agentRulesFile` can be used together — inline rules appear first, then file content is appended.

### Enable Failure Learnings (Layer 4)

Inject past session failures to help agents avoid repeating mistakes:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    learning:
      injectInPrompts: true
```

Learnings are limited to **3 entries**, filtered to failures only, and sorted by domain relevance to the current story.

### Enable Cross-Session Memory (Layer 5)

Share accumulated knowledge across sessions working on the same project:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    learning:
      injectInPrompts: true
      crossSessionMemory: true
```

Memory entries are deduplicated by content hash and the storage file rotates at 10MB.

### CLAUDE.md Merge (Parallel Mechanism)

In addition to the composed prompt, the orchestrator can merge provider-specific instructions into the worktree's `CLAUDE.md` file:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    sessionEnhancement:
      provider: omc
      config:
        autoInstall: true
        mergeStrategy: append
```

The composed prompt and CLAUDE.md merge operate independently — both are non-blocking. See [Prompt Layers](../advanced/prompt-layers/) for the full delivery mechanism comparison.

{: .note }
> Layers 4 and 5 are **off by default** — enable them explicitly per project. The composed prompt delivers dynamic task-specific context; the CLAUDE.md merge delivers static provider instructions.

---

## Step 5: Set Up the Verification Gate

The verification gate runs quality checks before marking a story as complete. It is opt-in and configured per-project.

### Basic Verification

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: true
        - type: typecheck
          command: "pnpm typecheck"
          required: false
      onFailure: review
```

### Check Types

| Type | Typical Command | Purpose |
|------|----------------|---------|
| `test` | `pnpm test` | Run unit and integration tests |
| `lint` | `pnpm lint` | Check code style and static analysis |
| `typecheck` | `pnpm typecheck` | Verify TypeScript types |
| `custom` | Any shell command | Project-specific validation |

### Failure Behavior

When all retries are exhausted, the final status depends on `onFailure`:

| onFailure | Final Status | Behavior |
|-----------|-------------|----------|
| `"review"` (default) | `review` | Human notified for review |
| `"block"` | `blocked` | Requires manual intervention |

### Add Auto-Retry

Give agents extra chances to fix failing checks:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
        - type: lint
          command: "pnpm lint"
      onFailure: review
      retry:
        enabled: true
        maxAttempts: 3
        backoffMs: 10000
```

### Add Persistent Execution

Persistent mode gives agents extra lives by re-queuing the session instead of falling back to human review:

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agentMappings:
      default:
        agents: ["claude-code"]
        executionMode: persistent
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
        - type: custom
          command: "npm run validate"
      onFailure: review
      persistent:
        persistentMaxRetries: 5
        persistentMaxExtensions: 3
```

{: .highlight }
> **Non-fatal:** If the verification runner itself throws an error, the story is still marked done. Verification never breaks the completion pipeline. See [Verification Gate](../core-concepts/verification-gate/) for the full lifecycle and event tracking.

---

## Step 6: Wire Everything Together

Combine reactions, hooks, prompt rules, and verification into a complete custom workflow:

```yaml
# agent-orchestrator.yaml — Complete custom workflow configuration

# Global reaction overrides
reactions:
  approved-and-green:
    auto: true
    action: auto-merge
  agent-stuck:
    auto: true
    action: notify
    priority: urgent
    threshold: "15m"

# Session enhancement (hooks + CLAUDE.md merge)
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append
  hookProfile:
    phases:
      - preCompact
      - postCompact
    enabledHooks:
      - notepad
      - projectMemory
    metadata:
      mode: full
      verify: "true"

# Project with full custom workflow
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    defaultBranch: main

    # Layer 3: Custom coding standards
    agentRules: |
      Always run tests before pushing.
      Use conventional commits (feat:, fix:, chore:).
      Never skip type checking.

    # Layer 3: Additional rules from file
    agentRulesFile: ".omc/agent-rules.md"

    # Layers 4-5: Failure learnings and cross-session memory
    learning:
      injectInPrompts: true
      crossSessionMemory: true

    # Per-project reaction overrides
    reactions:
      ci-failed:
        retries: 3
        escalateAfter: 3
        message: |
          CI is failing on your PR. Steps to debug:
          1. Run `gh pr checks` to see which checks failed
          2. Run `pnpm test` locally to reproduce
          3. Fix the failing tests and push again
      changes-requested:
        escalateAfter: "1h"

    # Per-project hook profile override
    sessionEnhancement:
      provider: omc
      hookProfile:
        enabledHooks:
          - notepad
          - projectMemory

    # Verification gate
    verification:
      enabled: true
      checks:
        - type: test
          command: "pnpm test"
          required: true
        - type: lint
          command: "pnpm lint"
          required: true
        - type: typecheck
          command: "pnpm typecheck"
          required: false
      onFailure: review
      retry:
        enabled: true
        maxAttempts: 3
        backoffMs: 10000
```

### How the Complete Workflow Operates

```text
Agent spawns
  ├─ Prompt composed (5 layers: base + config + rules + learnings + memory)
  ├─ CLAUDE.md merged (provider instructions)
  └─ Hooks registered (notepad + projectMemory)
      │
Agent works...
  ├─ CI fails → ci-failed reaction sends fix instructions to agent
  │     └─ Agent fixes → CI passes (or escalates after 3 attempts)
  ├─ Review comments → changes-requested reaction forwards to agent
  │     └─ Agent addresses → reviewer re-reviews (or escalates after 1h)
  ├─ Context compacts → preCompact hooks save state
  │     └─ postCompact hooks restore context
  └─ Agent completes → verification gate runs checks
        ├─ All pass → story marked done
        ├─ Check fails → auto-retry (up to 3 attempts)
        └─ Retries exhausted → status set to review
```

---

## Troubleshooting

### Reaction not firing

A reaction doesn't trigger when expected.

1. Check `auto` is set to `true` for the reaction
2. Verify the reaction key matches the event type (see the trigger mapping table)
3. Confirm the session is active — reactions don't fire for completed sessions
4. Check the lifecycle manager is running (it polls every 30 seconds)

```yaml
# Debug: set auto to true and check the reaction key
reactions:
  ci-failed:
    auto: true        # Must be true for automatic handling
    action: send-to-agent
```

### Hooks failing silently

Custom hooks don't seem to be saving or restoring state.

Hook errors are caught and logged — they never crash the session:

```bash
# Check logs for hook warnings
ao logs <session-id> --since 30m | grep hooks
```

Common causes:
- File path doesn't exist (create `.omc/` directory first)
- Hook function throws on invalid metadata
- Hook not registered before the first compaction event

### Prompt rules not injected

Custom `agentRules` don't appear in the agent's context.

1. Verify the field name is exactly `agentRules` (not `agent_rules` or `rules`)
2. If using `agentRulesFile`, confirm the path is relative to `project.path`
3. Check that the file exists — missing files are silently ignored
4. File-not-found does not produce an error — check paths carefully

```yaml
projects:
  my-app:
    agentRules: |
      Check this appears in agent context.
    agentRulesFile: ".omc/agent-rules.md"  # Relative to project.path
```

### Verification blocking completion

Stories get stuck in `blocked` status.

1. Change `onFailure` from `"block"` to `"review"` to allow human review
2. Check the failing command runs successfully locally
3. Increase `maxAttempts` if transient test failures are common

```yaml
verification:
  onFailure: review     # Use "review" instead of "block"
  retry:
    maxAttempts: 3      # Give more retry attempts
```

### Custom hook error affecting session

A custom hook throws an error.

Hooks are **error-isolated** — a failing custom hook cannot crash the compact cycle or prevent other hooks from running. Check the session logs for `[hooks]` warnings:

```text
[hooks] pre-compact hook "todoSaver" failed: ENOENT: no such file or directory
```

Fix the hook's error handling (wrap file operations in try/catch), or ensure the target directory exists before the hook runs.

---

## Next Steps

- **[Reactions Engine](../core-concepts/reactions-engine/)** — trigger mapping, escalation, per-project overrides
- **[Hooks & Extensions](../advanced/hooks-extensions/)** — hook registry API, built-in hooks, testing patterns
- **[Prompt Layers](../advanced/prompt-layers/)** — 5-layer composition, CLAUDE.md merge, delivery mechanisms
- **[Verification Gate](../core-concepts/verification-gate/)** — check types, auto-retry, persistent execution
- **[Custom Plugin Development](../advanced/custom-plugins/)** — building your own plugins
- **[Configuration](../getting-started/configuration/)** — full config reference
- **[CLI Reference](../cli/)** — all session, sprint, and monitoring commands

---

- **Parent** — [Tutorials](.)
- **Siblings** — [Your First Agent](first-agent/), [GitHub CI/CD Flow](github-ci-cd-flow/), [Multi-Agent Sprint](multi-agent-sprint/), [Portfolio Management](portfolio-management/)
- **Core Concepts** — [Reactions Engine](../core-concepts/reactions-engine/), [Verification Gate](../core-concepts/verification-gate/), [Sessions](../core-concepts/sessions/), [Memory & Learning](../core-concepts/memory-learning/)
- **Advanced** — [Hooks & Extensions](../advanced/hooks-extensions/), [Prompt Layers](../advanced/prompt-layers/), [Custom Plugin Development](../advanced/custom-plugins/)
- **Getting Started** — [Configuration](../getting-started/configuration/), [Quick Start](../getting-started/quick-start/)
- **Reference** — [CLI Reference](../cli/), [Session Commands](../cli/session-commands/), [Monitoring Commands](../cli/monitoring/)
