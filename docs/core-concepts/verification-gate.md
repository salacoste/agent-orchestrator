---
title: Verification Gate
nav_order: 6
parent: Core Concepts
description: How the verification gate runs quality checks before story completion — check types, auto-retry, persistent execution, and configuration.
---

# Verification Gate

The verification gate is an opt-in quality checkpoint that runs configured checks (tests, lint, typecheck, custom commands) before marking a story as complete. When checks fail, the orchestrator can automatically retry or re-queue persistent sessions before falling back to human review.

{: .highlight }
> **TL;DR:** 4 check types (`test`, `lint`, `typecheck`, `custom`), 3-layer fallback (verify → auto-retry → persistent re-queue), configurable per-project, non-fatal on internal errors, and opt-in via `verification.enabled`.

---

## How Verification Works

When an agent session completes, the completion handler checks whether verification is enabled for the project. If enabled, it runs all configured checks sequentially and decides what to do based on the results:

```text
Session completes
  │
  ├─ Verification enabled?
  │     └─ No → Mark done
  │
  ├─ Run all checks via runVerification()
  │     ├─ All required checks pass → Mark done
  │     └─ Any required check fails ↓
  │
  ├─ Layer 1: Auto-retry
  │     ├─ Under maxAttempts? → Retry with backoff
  │     └─ Retries exhausted ↓
  │
  ├─ Layer 2: Persistent re-queue
  │     ├─ Persistent mode? → Re-queue session
  │     └─ Not persistent or exhausted ↓
  │
  └─ Layer 3: Final status
        ├─ onFailure: "block" → status: blocked
        └─ onFailure: "review" → status: review
```

{: .highlight }
> **Non-fatal:** If the verification runner itself throws an error, the story is still marked done. Verification never breaks the completion pipeline.

---

## Verification Checks

Each project configures an array of checks to run. A check has **3 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"test" \| "lint" \| "typecheck" \| "custom"` | Category of the check |
| `command` | string | Shell command to execute |
| `required` | boolean? | `true` = failure blocks completion (default: `true`) |

### Check Types

| Type | Typical Command | Purpose |
|------|----------------|---------|
| `test` | `pnpm test` | Run unit and integration tests |
| `lint` | `pnpm lint` | Check code style and static analysis |
| `typecheck` | `pnpm typecheck` | Verify TypeScript types |
| `custom` | Any shell command | Project-specific validation |

### CheckResult

Each check produces a `CheckResult` with **8 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"test" \| "lint" \| "typecheck" \| "custom"` | Check category |
| `command` | string | Command that was executed |
| `passed` | boolean | Whether the check succeeded |
| `exitCode` | number | Process exit code (0 = success) |
| `stdout` | string | Last 500 chars of stdout |
| `stderr` | string | Last 500 chars of stderr |
| `duration` | number | Execution time in milliseconds |
| `required` | boolean | Whether this check was required |

### VerificationResult

The aggregate result has **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `passed` | boolean | `true` if all required checks passed |
| `checks` | CheckResult[] | Individual check results |
| `ranAt` | string | ISO timestamp of when checks ran |
| `duration` | number | Total verification time in ms |

Optional checks that fail are recorded in `checks` but do not affect the `passed` flag.

---

## Auto-Retry

When verification fails, the orchestrator can automatically retry before giving up. This is controlled by `scheduleVerificationRetry()`:

```text
Verification fails
  │
  ├─ onFailure === "block"? → Skip retry
  │
  ├─ retry.enabled === false? → Skip retry
  │
  ├─ retryCount >= maxAttempts? → Skip retry
  │
  └─ Schedule retry
        ├─ Record attempt in metadata
        ├─ Write context to .omc/notepad.md
        └─ Set status: in-progress
```

### VerificationRetryConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable automatic retries |
| `maxAttempts` | number | `2` (max: 5) | Maximum retry attempts |
| `backoffMs` | number | `5000` | Delay before retry in ms |

### VerificationRetryAttempt

Each retry attempt is recorded with **3 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `attempt` | number | 1-based attempt number |
| `ranAt` | string | ISO timestamp of retry |
| `result` | VerificationResult | Check results from retry |

On each retry, a "Verification Retry Context" section is appended to `.omc/notepad.md` with details about which checks failed and which passed, giving the agent context for its next attempt.

---

## Persistent Execution

Persistent execution mode gives agents extra lives. When auto-retries are exhausted and the agent is running in persistent mode, the orchestrator re-queues the session instead of falling back to human review:

```text
Auto-retries exhausted
  │
  ├─ executionMode !== "persistent"? → Skip
  │
  ├─ onFailure === "block"? → Skip
  │
  ├─ requeueCount >= persistentMaxRetries? → Skip
  │
  └─ Re-queue session
        ├─ Increment requeue count in metadata
        ├─ Write context to .omc/notepad.md
        └─ Set status: in-progress
```

### PersistentConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `persistentMaxRetries` | number | `5` | Max re-queue attempts |
| `persistentMaxExtensions` | number | `3` | Max timeout extensions |

### Execution Mode Timeouts

Persistent sessions get longer timeouts due to the extra retry cycles:

| Mode | Multiplier | Example (30m base) |
|------|-----------|-------------------|
| `standard` | 1.0x | 30 minutes |
| `persistent` | 3.0x | 90 minutes |
| `lightweight` | 0.5x | 15 minutes |

---

## Failure Behavior

When all retries and re-queues are exhausted, the final status depends on `onFailure`:

| onFailure | Final Status | Behavior |
|-----------|-------------|----------|
| `"review"` (default) | `review` | Human notified for review |
| `"block"` | `blocked` | Requires manual intervention |

### Audit Events

The verification gate emits **5 event types** during its lifecycle:

| Event | When |
|-------|------|
| `verification.passed` | All checks pass |
| `verification.failed` | One or more required checks fail |
| `verification.retry_scheduled` | Auto-retry scheduled |
| `verification.retry_exhausted` | All retry attempts used |
| `verification.persistent_requeue` | Persistent session re-queued |

---

## Configuration

Verification is opt-in and configured per-project in `agent-orchestrator.yaml`:

### Basic Verification

```yaml
projects:
  my-app:
    repo: org/repo
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

### With Auto-Retry

```yaml
projects:
  my-app:
    repo: org/repo
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

### With Persistent Execution

```yaml
projects:
  my-app:
    repo: org/repo
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

### VerificationConfig Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | Required | Enable verification gate (`true` to activate) |
| `checks` | VerificationCheck[] | — | Array of checks to run (min 1) |
| `onFailure` | `"block" \| "review"` | `"review"` | Behavior when all retries exhausted |
| `retry` | VerificationRetryConfig? | (defaults) | Auto-retry configuration |
| `persistent` | PersistentConfig? | (defaults) | Persistent execution config |

See the [Configuration](../../getting-started/configuration/) page for the full config reference.

---

## Next Steps

- **[Sessions](../sessions/)** — the 18-state session lifecycle and spawn pipeline
- **[Stories & Sprints](../stories-sprints/)** — story model, assignment flow, completion handling
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
