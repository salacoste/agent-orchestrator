---
title: Memory & Learning
nav_order: 5
parent: Core Concepts
description: How agents learn from past sessions — 3-tier memory architecture, structured learnings, cross-session knowledge, prompt injection, and failure pattern detection.
---

# Memory & Learning

Agent Orchestrator uses a 3-tier memory architecture that lets agents learn from past sessions. When a session completes, its outcomes are captured as structured learnings and stored in JSONL files. On the next spawn, relevant learnings are injected into the agent's prompt so it can avoid repeating mistakes and follow established conventions.

{: .highlight }
> **TL;DR:** 2 pipelines (Structured Learnings + Cross-Session Knowledge), 3 memory tiers (ephemeral, session-persistent, cross-session), 5-layer prompt injection, compaction survival, and failure pattern detection. All opt-in via project config.

---

## Memory Architecture

Agents have access to 3 tiers of memory, each with different scope and persistence:

```text
┌─────────────────────────────────────┐
│ Tier 3: Cross-Session               │
│   .omc/cross-session-memory.jsonl   │
│   Shared across all sessions        │
├─────────────────────────────────────┤
│ Tier 2: Session-Persistent          │
│   .omc/project-memory.json          │
│   Survives compaction               │
├─────────────────────────────────────┤
│ Tier 1: Ephemeral                   │
│   In-context only (prompt text)     │
│   Lost when session ends            │
└─────────────────────────────────────┘
```

| Tier | Storage | Scope | Persistence |
|------|---------|-------|-------------|
| **Ephemeral** | In-context only | Current session | Lost on session end |
| **Session-persistent** | `.omc/project-memory.json` | Current session | Survives compaction |
| **Cross-session** | `.omc/cross-session-memory.jsonl` | All sessions in project | Permanent (90-day default retention) |

---

## Pipeline A: Structured Learnings

When a session completes (or fails), the orchestrator captures a `SessionLearning` record with **13 fields** and stores it in an append-only JSONL file:

### Capture Flow

```text
Session completes → CompletionEvent / FailureEvent
  │
  ├─ captureSessionLearning()
  │     ├─ Determine outcome (completed/failed/abandoned)
  │     ├─ Get modified files (git diff --name-only)
  │     ├─ Infer domain tags from file paths
  │     └─ Count test files added
  │
  └─ LearningStore.store() → learnings.jsonl
```

### SessionLearning Fields

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session that generated this learning |
| `agentId` | string | Agent type that ran the session |
| `storyId` | string | Story the session was working on |
| `projectId` | string | Project the session belonged to |
| `outcome` | `"completed" \| "failed" \| "blocked" \| "abandoned"` | How the session ended |
| `durationMs` | number | Total session duration in milliseconds |
| `retryCount` | number | Number of retries during the session |
| `filesModified` | string[] | File paths changed (no contents) |
| `testsAdded` | number | Number of test files created |
| `errorCategories` | string[] | Error categories encountered |
| `domainTags` | string[] | Inferred domain categories |
| `completedAt` | string | ISO timestamp of completion |
| `capturedAt` | string | ISO timestamp of capture |

### Domain Tag Inference

File paths are mapped to **5 domain categories**:

| Tag | Matches |
|-----|---------|
| `frontend` | `.tsx`, `.jsx`, `/components/` paths |
| `testing` | `.test.`, `.spec.` in filename |
| `api` | `route.ts`, `/api/` paths |
| `styling` | `.css`, `.scss` extensions |
| `backend` | Fallback for `.ts`, `.js` files |

### LearningStore

The `LearningStore` interface provides 5 methods:

| Method | Description |
|--------|-------------|
| `store(learning)` | Append a learning record to JSONL |
| `list()` | Return all stored learnings |
| `query(params)` | Filter by agent, domain, outcome, or date |
| `start()` | Initialize the store |
| `stop()` | Clean up resources |

**Query parameters** (`LearningQuery`): `agentId`, `domain`, `outcome`, `sinceMs`, `limit`

**Storage:** `{sessionsDir}/learnings.jsonl` with configurable 10MB rotation and 90-day retention.

---

## Pipeline B: Cross-Session Knowledge

Cross-session knowledge accumulates across all sessions in a project. When a session completes, its `.omc/project-memory.json` is extracted and merged into the project-level JSONL store.

### Knowledge Extraction Flow

```text
Session completes → .omc/project-memory.json exists?
  │
  ├─ extractMemoryFromWorkspace()
  │     └─ Read project-memory.json from workspace
  │
  ├─ computeContentHash() → MD5(type + ":" + content)
  │
  └─ appendEntries() → .omc/cross-session-memory.jsonl
        └─ Append-only write (never modifies in-place)
```

### Entry Types

Knowledge entries have **4 types**:

| Type | Description |
|------|-------------|
| `convention` | Code conventions and patterns |
| `decision` | Architectural decisions |
| `directive` | Explicit instructions |
| `learning` | Lessons from past work |

### CrossSessionMemoryEntry

Each entry extends `ProjectMemoryEntry` with **4 dedup fields**:

| Field | Type | Description |
|-------|------|-------------|
| `contentHash` | string | MD5 hash of `type:content` for dedup |
| `sourceSessionIds` | string[] | Sessions where this knowledge originated |
| `firstSeenAt` | string | ISO timestamp of first appearance |
| `lastSeenAt` | string | ISO timestamp of most recent appearance |

### Dedup and Rotation

**Dedup strategy:** Content-hash deduplication happens at **load time**, not write time. This prevents TOCTOU (time-of-check-time-of-use) races when multiple sessions write concurrently. Append-only writes are always safe; dedup merges happen when reading.

**File rotation:** When the JSONL file exceeds **10MB** (configurable), it is renamed with a date stamp (e.g., `cross-session-memory-2026-04-22T14-30-00.jsonl`) and a fresh file is started. Old rotated files are retained until the 90-day retention period expires.

**Write lock:** A per-project lock manager serializes rewrite operations (remove/update) to prevent concurrent read-modify-write races.

**Non-fatal:** All memory bridge operations are non-fatal. Errors are logged but never block session completion or spawn.

---

## Prompt Injection

When a new session spawns, relevant learnings and cross-session knowledge are injected into the agent's prompt. The prompt is composed in **5 layers**:

```text
Agent Prompt Composition
  │
  ├─ Layer 1: Base Agent Prompt
  │     └─ Constant (lifecycle, git, PRs)
  │
  ├─ Layer 2: Config context
  │     └─ Project, repo, branch, reactions
  │
  ├─ Layer 3: User Rules
  │     └─ agentRules / agentRulesFile
  │
  ├─ Layer 4: Past Learnings (Pipeline A)
  │     └─ Failed/blocked outcomes
  │
  └─ Layer 5: Cross-Session (Pipeline B)
        └─ Conventions, decisions, learnings
```

### Layer 4: Past Session Learnings

Only **failed** outcomes are injected (completed outcomes aren't instructive). Learnings are formatted as:

```
## Lessons from Past Sessions
1. [story-42] failed — 3 errors (network, timeout) — duration: 12m
   Domains: api, backend
```

The `selectRelevantLearnings()` function filters by domain match and limits to **3 entries** by default.

### Layer 5: Cross-Session Knowledge

Formatted from `buildCrossSessionMemoryLayer()`, organized into subsections by entry type:

```
## Cross-Session Knowledge
### Conventions
- Use execFile instead of exec for security
### Decisions
- ESM modules with .js extension in imports
```

{: .highlight }
> **Opt-in:** Both layers require explicit configuration. Set `learning.injectInPrompts: true` for Layer 4 and `learning.crossSessionMemory: true` for Layer 5.

---

## Compaction Survival

When an agent session undergoes context compaction (its conversation history is compressed), the `projectMemoryPreCompact` hook ensures working memory is preserved:

1. **Read** existing `.omc/project-memory.json`
2. **Merge** learnings from session metadata (`sessionMetadata["learnings"]`)
3. **First-write-wins** — existing entries are never overwritten
4. **Atomic write** — uses temp-file-then-rename pattern

The hook is registered in the lifecycle as a `preCompact` handler, so it runs before every compaction event.

### ProjectMemory Format

`.omc/project-memory.json` uses the `ProjectMemory` structure:

```json
{
  "entries": [
    {
      "id": "entry-1",
      "type": "convention",
      "content": "Use execFile instead of exec",
      "source": "session-abc123",
      "timestamp": "2026-04-22T10:00:00Z"
    }
  ]
}
```

Each entry has: `id`, `type` (one of 4 entry types), `content`, optional `source`, and optional `timestamp`.

---

## Failure Pattern Detection

The `detectPatterns()` function analyzes stored learnings for recurring failure categories. A pattern is recognized when the same error category appears **3 or more times** (`MIN_PATTERN_THRESHOLD = 3`):

### FailurePattern Fields

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | Error category (e.g., network, parse) |
| `occurrenceCount` | number | Total occurrences across sessions |
| `affectedStories` | string[] | Story IDs where this pattern appeared |
| `lastOccurrence` | string | ISO timestamp of most recent occurrence |
| `suggestedAction` | string | Heuristic recommendation |

### Suggested Actions

| Category Pattern | Suggested Action |
|-----------------|-----------------|
| Network errors (ECONNREFUSED, ETIMEDOUT) | Check network connectivity and service availability |
| Parse/syntax/YAML errors | Review input data format and validation |
| Permission/auth errors | Verify file permissions and authentication credentials |
| Disk/memory errors | Check available disk space and memory |
| Exit code errors | Review agent logs for root cause of non-zero exit |
| All others | Investigate recurring error and consider adding preventive checks |

### Consumers

- **Post-mortem generator** (`postmortem-generator.ts`) — includes detected patterns in automated post-mortem reports
- **CLI** (`ao learning-patterns`) — displays patterns in the terminal

---

## CLI Commands

### View failure patterns

```bash
ao learning-patterns [--json]
```

Displays a table with Pattern, Count, Stories, Last Seen, and Suggested Action columns.

### View agent history

```bash
ao agent-history <agent-id> [--since 7d] [--limit 20] [--json]
```

Shows a table with Story, Outcome (color-coded), Duration, Domains, and Date columns.

**Outcome indicators:** completed (green), failed (red), blocked (yellow), abandoned (black)

---

## Configuration

Learning features are opt-in and configured per-project in `agent-orchestrator.yaml`:

```yaml
projects:
  my-app:
    repo: org/repo
    learning:
      injectInPrompts: true       # Layer 4: inject past learnings
      injectFindings: true         # Include review findings
      retentionDays: 90            # JSONL retention period (default: 90)
      crossSessionMemory: true     # Layer 5: cross-session knowledge
```

| Setting | Default | Description |
|---------|---------|-------------|
| `injectInPrompts` | `false` | Inject past session learnings into prompts |
| `injectFindings` | `false` | Include code review findings in prompts |
| `retentionDays` | `90` | Days to retain JSONL learning data |
| `crossSessionMemory` | `false` | Enable cross-session knowledge sharing |

See the [Configuration](../../getting-started/configuration/) page for the full config reference.

---

## Next Steps

- **[Sessions](../sessions/)** — the 18-state session lifecycle and spawn pipeline
- **[Reactions Engine](../reactions-engine/)** — event-driven reaction engine reference
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
