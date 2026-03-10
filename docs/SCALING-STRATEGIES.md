# Scaling Strategies

How to scale Agent Orchestrator from a few sessions to hundreds of concurrent AI agents.

---

## Understanding the Architecture

Agent Orchestrator is **stateless** — no database, just flat metadata files + JSONL event log. This makes scaling straightforward but introduces specific bottlenecks to understand.

### Core Scaling Components

```
                    ┌─────────────────────────┐
                    │   Lifecycle Manager      │
                    │   (polling loop)         │
                    │   - 30s default interval │
                    │   - re-entrancy guard    │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Session Mgr  │  │ Event System │  │ Notification │
    │ - spawn      │  │ - JSONL log  │  │ - routing    │
    │ - list       │  │ - SSE stream │  │ - coalescing │
    │ - kill       │  │ - audit trail│  │ - DLQ        │
    └──────┬──────┘  └──────────────┘  └──────────────┘
           │
    ┌──────┼──────────────┐
    ▼      ▼              ▼
 Runtime  Workspace    Agent
 (tmux)   (worktree)   (claude-code)
```

---

## Resource Consumption Per Session

| Resource | Per Session | Notes |
|----------|------------|-------|
| Disk (worktree) | 500MB–2GB | Depends on repo size; shared git objects |
| Disk (metadata) | ~1KB | Flat key=value file |
| Memory (tmux) | ~5–10MB | Terminal buffer |
| Memory (agent) | 200–500MB | AI agent process (Claude Code, Codex) |
| File descriptors | 10–20 | Per session + tmux + agent process |
| CPU | Variable | Agent thinking = high; idle = near zero |

**Rule of thumb**: A machine with 32GB RAM and 500GB disk can comfortably run **15–25 concurrent sessions**.

---

## Scaling Tiers

### Tier 1: Individual Developer (1–10 Sessions)

**Setup**: Default configuration, no tuning needed.

```yaml
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [desktop]
```

**What to expect:**

- Poll interval: 30s (default) — fine for this scale
- All sessions on one machine
- Desktop notifications sufficient
- Worktrees share git objects — disk efficient
- No conflict detection issues

**Commands:**

```bash
ao spawn my-app 42
ao spawn my-app 43
ao status
```

---

### Tier 2: Power User (10–50 Sessions)

**Setup**: Add Slack notifications, tune polling, use batch spawn.

```yaml
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [desktop, slack]

reactions:
  ci-failed:
    auto: true
    action: send-to-agent
    retries: 2
  changes-requested:
    auto: true
    action: send-to-agent
    escalateAfter: 30m
  approved-and-green:
    auto: true
    action: auto-merge          # Trust the process

notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}

notificationRouting:
  urgent: [desktop, slack]
  action: [slack]
  warning: [slack]
  info: [slack]
```

**Tuning:**

- Enable auto-merge for approved PRs — reduces human bottleneck
- Use `ao batch-spawn` for sprint execution
- Monitor with `ao fleet` or the web dashboard
- Disk: allocate 100GB+ for worktrees

**Conflict awareness:**

- At 10+ sessions, agents may touch overlapping files
- The conflict detection system scores assignments and warns
- Use `ao conflicts` to check, `ao resolve-conflicts` to handle

---

### Tier 3: Team Scale (50–200 Sessions)

**Setup**: Increase poll interval, add Redis event bus, multiple projects.

```yaml
readyThresholdMs: 600000       # 10 min before "ready" → "idle"

projects:
  frontend:
    repo: org/frontend
    path: ~/frontend
    sessionPrefix: fe
  backend:
    repo: org/backend
    path: ~/backend
    sessionPrefix: api
  mobile:
    repo: org/mobile
    path: ~/mobile
    sessionPrefix: mob
```

**Key adjustments:**

| Parameter | Default | Recommended |
|-----------|---------|-------------|
| Poll interval | 30s | 60s |
| Ready threshold | 5m | 10m |
| CI retry limit | 2 | 1–2 |
| Escalation timeout | 30m | 1h |
| DLQ alert threshold | 1000 | 500 |

**Infrastructure:**

- **Redis event bus**: Deploy for reliable event distribution
  ```yaml
  eventBus:
    plugin: redis
    url: redis://localhost:6379
  ```
- **Dedicated disk**: 500GB+ SSD for worktrees
- **Monitoring**: Use `ao health` and web dashboard actively

---

### Tier 4: Enterprise (200+ Sessions)

**Strategy**: Shard by project across multiple orchestrator instances.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Orchestrator A  │     │  Orchestrator B  │     │  Orchestrator C  │
│  frontend (50)   │     │  backend (50)    │     │  mobile (50)     │
│  config-a.yaml   │     │  config-b.yaml   │     │  config-c.yaml   │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                         │
         └────────────────────────┼─────────────────────────┘
                                  │
                          ┌───────▼──────┐
                          │    Redis     │
                          │  Event Bus   │
                          └──────────────┘
                                  │
                          ┌───────▼──────┐
                          │    Slack     │
                          │  Notifier   │
                          └──────────────┘
```

**Each instance gets its own:**

- `agent-orchestrator.yaml` with subset of projects
- Data directory (hash-based, automatically unique)
- Poll cycle (independent, no cross-instance coordination)

**Shared via Redis:**

- Event distribution
- Real-time dashboard updates
- Cross-instance notifications

**Tuning for 200+:**

| Parameter | Recommended |
|-----------|-------------|
| Poll interval | 90–120s |
| Session enrichment timeout | 3–5s |
| DLQ alert threshold | 250 |
| Blocked agent timeout | 15–20m |
| Circuit breaker open duration | 60–120s |

---

## Bottleneck Analysis

### 1. Session List Enrichment

**What**: Each poll cycle calls `list()` which enriches every session in parallel (runtime alive check + activity detection). Each enrichment has a 2-second timeout.

**Impact**: With 100 sessions, worst case = 3.4 minutes for full list.

**Mitigation:**

- Re-entrancy guard prevents overlapping polls
- Increase poll interval as session count grows
- Failed enrichments timeout gracefully (session shows stale data, not error)

### 2. Polling Interval vs Session Count

**Formula for dynamic interval:**

```
interval_ms = max(30000, sessionCount * 600)
```

| Sessions | Recommended Interval |
|----------|---------------------|
| 1–50 | 30s |
| 50–100 | 60s |
| 100–200 | 90s |
| 200–500 | 120s |
| 500+ | 180s+ or shard |

### 3. Disk Space for Worktrees

Git worktrees share objects with the main repo, so they're smaller than full clones.

**Estimated disk per worktree:**

| Repo Size | Worktree Size | 50 Sessions |
|-----------|--------------|-------------|
| 100MB | ~50MB | ~2.5GB |
| 500MB | ~200MB | ~10GB |
| 2GB | ~800MB | ~40GB |
| 10GB | ~4GB | ~200GB |

**Cleanup**: Worktrees are not auto-cleaned. After sessions complete (merged/killed), run:

```bash
cd ~/your-repo
git worktree prune          # Remove stale worktree references
```

### 4. tmux Session Limits

tmux itself supports 1000+ sessions easily. The real limits are:

- **File descriptors**: `ulimit -n` (default 256 on macOS — increase to 4096+)
- **Process count**: Each session = 1 tmux + 1 agent process
- **Terminal buffer memory**: ~5–10MB per session

**Fix macOS FD limit:**

```bash
ulimit -n 4096
# Or permanently in /etc/launchd.conf
```

---

## Resilience & Failure Handling

### Retry Service

Exponential backoff with jitter for transient failures:

```
Attempt 1: 1s  (± 10% jitter)
Attempt 2: 2s
Attempt 3: 4s
Attempt 4: 8s
Attempt 5: 16s
Attempt 6: 32s
Attempt 7: 60s (capped)
```

Max 7 attempts by default. Non-retryable errors go directly to DLQ.

### Circuit Breaker

Protects against cascading failures when external services are down:

```
CLOSED ──[5 failures]──► OPEN ──[30s wait]──► HALF-OPEN ──[success]──► CLOSED
                                                    │
                                                    └──[failure]──► OPEN
```

- **Failure threshold**: 5 (configurable)
- **Open duration**: 30s (configurable)
- Applied to: GitHub API, Linear API, Slack webhook, CI checks

### Dead Letter Queue (DLQ)

Operations that fail all retries land in the DLQ:

```bash
ao dlq                  # List failed operations
ao dlq retry <id>       # Retry specific entry
ao dlq drain            # Retry all entries
ao dlq purge --before 7d   # Clean old entries
```

**Storage**: `dlq.jsonl` in the data directory. Auto-rotates at 10MB, 30-day retention.

**Alert threshold**: 1000 entries (configurable). High DLQ count indicates systematic failures.

### Degraded Mode

When services become unavailable, the orchestrator degrades gracefully:

| Mode | Trigger | Behavior |
|------|---------|----------|
| Normal | All services healthy | Full functionality |
| Event bus unavailable | Redis down | Queue events in memory + disk backup |
| Tracker unavailable | Linear/GitHub API down | Queue sync operations |
| Multiple unavailable | >1 service down | Minimal operations only |

Recovery is automatic — queued events drain when services come back.

---

## Monitoring

### Health Checks

```bash
ao health               # System health overview
```

Checks:

- tmux availability
- GitHub CLI authentication
- Disk space
- Active session count
- DLQ depth
- Event bus connectivity (if Redis configured)

### Key Metrics to Watch

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Session enrichment timeout rate | >10% | >30% | Increase poll interval |
| DLQ depth | >100 | >500 | Investigate root cause |
| Circuit breaker open | Any | >5min | Check external service |
| Degraded mode | >1min | >10min | Check Redis/API |
| Disk usage | >70% | >90% | Prune worktrees |
| Memory (orchestrator) | >500MB | >1GB | Check for leaks |

### Web Dashboard

```bash
ao dashboard            # Opens http://localhost:3000
```

Real-time via Server-Sent Events:

- Session status, activity, PR state
- CI check results
- Conflict detection
- Event history
- DLQ management

---

## Conflict Detection at Scale

When multiple agents work on the same codebase, conflicts can occur.

### How It Works

1. **Assignment check**: Before spawning, `canAssign(storyId, agentId)` checks for existing assignments
2. **Priority scoring**: Agents get priority scores (0–1) based on:
   - Time invested (longer = higher priority)
   - Agent type (story agents > CLI-spawned)
   - Retry count (more retries = lower priority)
3. **Auto-resolution**: If score difference > 0.3, lower-priority agent is reassigned
4. **Manual resolution**: `ao resolve-conflicts` for ambiguous cases

### Prevention Strategies

- **Session prefixes**: Use distinct prefixes per project to avoid naming collisions
- **Branch conventions**: Agent-generated branches include issue number (`feat/issue-42`)
- **File-level isolation**: Different issues typically touch different files
- **Review gates**: PR reviews catch remaining conflicts

---

## Performance Optimization Checklist

- [ ] Set `ulimit -n 4096` (or higher) for file descriptors
- [ ] Use SSD storage for worktree base directory
- [ ] Increase poll interval based on session count
- [ ] Enable auto-merge for approved PRs (reduces manual bottleneck)
- [ ] Configure Slack notifications (don't rely on polling dashboard)
- [ ] Deploy Redis event bus for 50+ sessions
- [ ] Set up DLQ alerting
- [ ] Schedule worktree cleanup (`git worktree prune`)
- [ ] Monitor disk usage on worktree volume
- [ ] Shard across instances at 200+ sessions
