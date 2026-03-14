---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-summary', 'step-wd-feature-architecture', 'step-wd-structure', 'step-wd-validation', 'step-wd-complete']
status: 'complete'
completedAt: '2026-03-13'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-workflow-dashboard.md
  - _bmad-output/project-context.md
  - docs/design/design-brief.md
  - docs/design/orchestrator-terminal-designbrief.md
workflowType: architecture
project_name: 'agent-orchestrator'
user_name: 'R2d2'
date: '2026-03-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---
## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The PRD defines 50 functional requirements across 7 capability areas that drive architectural decisions:

1. **Sprint Planning & Agent Orchestration (FR1-FR8)**: CLI-based agent spawning with story context, agent assignment algorithms, resume capability for blocked stories
2. **State Synchronization (FR9-FR16)**: Bidirectional sync between BMAD (sprint-status.yaml) and Agent Orchestrator with ≤5-second latency requirement
3. **Event Bus & Notifications (FR17-FR24)**: Pub/sub event system for state changes, push-based notifications for human judgment, event deduplication and durable persistence
4. **Dashboard & Monitoring (FR25-FR32)**: Real-time burndown charts, fleet monitoring matrix, agent session cards with status indicators, drill-down logs and audit trails
5. **Error Handling & Recovery (FR33-FR40)**: Graceful degradation on service unavailability, event bus backlog recovery, data corruption detection with backup/restore
6. **Conflict Resolution & Coordination (FR41-FR44)**: Multi-agent conflict detection and resolution (Phase 2)
7. **Plugin & Workflow Extensibility (FR45-FR50)**: Custom workflow plugins with startup validation and type definitions (Phase 3)

**Non-Functional Requirements:**

47 NFRs that will drive architectural decisions:

- **Performance (9 NFRs)**: ≤5s state sync latency (p95), ≤10s agent spawn time, ≤500ms CLI response, ≤2s dashboard load, 100+ events/second throughput, ≤500ms event latency
- **Security (11 NFRs)**: API key protection (permissions 600), no keys in logs, encrypted config values, CLI respects file permissions, `execFile` not `exec` for shell commands, 30s timeout defaults
- **Scalability (8 NFRs)**: 10+ concurrent agents without >10% degradation, linear event bus scaling, 100+ stories per sprint, 10+ concurrent projects, 1000 burst events in 10s
- **Integration (9 NFRs)**: Plugin loading within 2s, plugin failures don't crash core process, TypeScript type definitions, BMAD sprint-status.yaml v1.0+ compatibility
- **Reliability (10 NFRs)**: 99.5% uptime, CLI functions available when dashboard unavailable, graceful degradation, zero state loss, append-only JSONL audit trail

**Scale & Complexity:**

- **Project complexity**: HIGH (multi-agent coordination, event bus architecture, state sync, conflict resolution)
- **Primary domain**: Developer Infrastructure / DevOps
- **Estimated architectural components**: 8-12 major components (Event Bus, State Manager, Plugin Loader, Agent Coordinator, Notification Service, Dashboard Service, CLI Interface, BMAD Tracker Plugin)

### Technical Constraints & Dependencies

**Technology Stack Constraints:**
- Runtime: Node.js ≥20.0.0 (required for ESM, TypeScript, plugin system)
- Language: TypeScript 5.7.0 (type safety, plugin interfaces)
- Package Manager: pnpm 9.15.4 (workspace monorepo)
- Web Framework: Next.js 15.1.0 App Router with React 19.0.0
- Testing: Vitest 4.0.18 (core), Playwright (E2E)

**Architecture Constraints:**
- 8-slot plugin architecture (Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, Lifecycle)
- ESM modules with `.js` extension requirement
- `node:` prefix for builtins (`node:fs`, `node:child_process`)
- Event bus pattern for state change propagation
- YAML + Zod for configuration validation
- JSONL event log for audit trail

**Integration Dependencies:**
- BMAD tracker plugin (sprint-status.yaml format)
- Git host integration (GitHub, GitLab, Bitbucket)
- Runtime systems (tmux, process, Docker)

**Development Workflow Constraints:**
- Build before dev (Next.js imports from core/plugins)
- agent-orchestrator.yaml config required for operations
- pnpm workspaces for monorepo structure

### Cross-Cutting Concerns Identified

**Event Bus Architecture:**
- Pub/sub pattern for state change propagation
- Multiple concurrent subscribers (5+ in Phase 2)
- Event deduplication and ordering
- Durable persistence for recovery
- Backlog recovery after service restart

**State Management:**
- Bidirectional sync between BMAD and Agent Orchestrator
- Conflict detection and resolution for concurrent updates
- Eventual consistency with deduplication
- Audit trail for all state transitions

**Error Handling & Resilience:**
- Graceful degradation when services unavailable
- Watchdog restart for critical processes
- Exponential backoff for retries
- Health monitoring and alerting

**Plugin Isolation:**
- Plugin failures don't crash core process
- Startup validation (2s timeout)
- TypeScript type definitions for compile-time validation
- Sandbox execution where feasible

**Security Boundaries:**
- `execFile` not `exec` for shell commands
- API keys never in logs
- File permission enforcement
- Timeout limits on all external operations

---

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield Extension Project** — Extending existing Agent Orchestrator with BMAD workflow orchestration capabilities

### Starter Options Considered

**N/A — This is a brownfield project with existing architecture**

### Selected Starter: Existing Architecture

**Rationale for Selection:**

This is an **extension project**, not a new application. The Agent Orchestrator codebase already has:

- Established plugin architecture with 8 slots
- Working CLI with Commander.js
- Next.js dashboard with React 19.0.0
- TypeScript configuration and ESM module system
- Testing infrastructure (Vitest, Playwright)
- pnpm workspace monorepo structure

**Architecture Decision:** Build on existing patterns rather than introducing new frameworks or reorganization.

**Note:** This architecture document will define NEW architectural decisions (event bus, state sync, conflict resolution) that extend the existing 8-slot plugin system.

---

## Core Architectural Decisions

### Decision 1: Event Bus Architecture

**Selected:** Redis Pub/Sub

**Rationale:**
- **Cross-Process Distribution** — Multiple processes (CLI, dashboard, agent orchestrator) need to receive events in real-time
- **Durability** — Events persist across service restarts, enabling backlog recovery (NFR-R9)
- **Performance** — Sub-millisecond pub/sub latency meets NFR-P7 (≤500ms event latency p95)
- **Scalability** — Supports 100+ events/second (NFR-P6) and burst events of 1000 in 10s (NFR-SC5)
- **Enterprise Ready** — Proven reliability for multi-agent coordination (Phase 2)

**Alternatives Considered:**

| Option | Pros | Cons | Decision |
|--------|-------|-------|----------|
| Native EventEmitter | Built into Node.js, zero deps, fast | In-memory only, no cross-process | Declined — cross-process required |
| **Redis Pub/Sub** | **Cross-process, durable, fast** | **External dependency, operational overhead** | **Selected** |
| RabbitMQ | Enterprise features, durable | Heavy weight, complex ops | Declined — overkill for event bus |
| Apache Kafka | High throughput, durable | Heavy ops complexity, overkill | Declined — overkill for event bus |

**Technical Details:**

```typescript
// Event Bus Service Interface
interface EventBus {
  // Publish events to all subscribers
  publish(event: Event): Promise<void>;

  // Subscribe to specific event types
  subscribe(eventType: string, handler: EventHandler): Disposable;

  // Replay events from log (for recovery)
  replay(since?: Date): AsyncIterable<Event>;

  // Get current backlog size (for health monitoring)
  getBacklogSize(): Promise<number>;
}
```

**Implementation Notes:**
- **Redis Client**: Use `ioredis` (TypeScript-first, Promise-based, ESM-compatible)
- **Channel Naming**: `ao:{project}:{eventType}` for namespacing
- **Event Serialization**: JSON with schema validation (Zod)
- **Persistence**: Enable Redis AOF for durability
- **Connection Pooling**: Reuse connections across services

**Affected Components:**
- Event Bus Service (new in `packages/core/src/services/event-bus.ts`)
- State Manager (publishes state changes)
- Dashboard API (subscribes to real-time updates via SSE)
- Agent Coordinator (subscribes to story assignments)
- BMAD Tracker Plugin (publishes YAML changes)
- CLI (subscribes to agent status events)

**Migration Path:**
- **Phase 1 (MVP)**: Redis required for full functionality
- **Fallback**: If Redis unavailable, degrade to in-memory EventEmitter with warning
- **Future**: Consider Redis Streams for event replay capability

---

### Decision 2: State Management Strategy

**Question:** How do we manage state synchronization between BMAD (sprint-status.yaml) and Agent Orchestrator while handling concurrent updates and ensuring consistency?

**Context:**
- **Two Sources of Truth**: BMAD `sprint-status.yaml` (manual updates) and Agent Orchestrator (agent activity)
- **Bidirectional Sync**: Changes flow both directions with ≤5-second latency (NFR-P1, NFR-P10, NFR-P11)
- **Concurrent Updates**: Multiple agents and humans may update state simultaneously
- **Conflict Detection**: Must detect when same story updated concurrently (FR41, FR44)
- **Audit Trail**: All transitions logged to JSONL (FR14, NFR-R8)

**Options:**

| Option | Approach | Pros | Cons |
|--------|----------|-------|-------|
| **A. YAML as Source** | Read/write YAML directly, Agents update file | Simple, human-editable | Merge conflicts, no atomicity |
| **B. State Manager Service** | Service owns state, syncs to YAML periodically | Atomic updates, conflict detection | Added complexity |
| **C. Database + YAML Sync** | Postgres/SQLite as source, export to YAML | ACID transactions, querying | Heavy dependency, sync complexity |
| **D. Optimistic Locking** | Version field on each story, reject stale updates | No locks, fast performance | Requires retry logic |

**Trade-offs:**

| Concern | A (YAML) | B (Service) | C (DB) | D (Locking) |
|---------|----------|-------------|--------|-------------|
| Simplicity | ✅ Best | ⚠️ Medium | ❌ Complex | ⚠️ Medium |
| Conflict Detection | ❌ Manual | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Human Editable | ✅ Yes | ⚠️ Via export | ❌ No | ⚠️ Via export |
| Performance | ⚠️ File I/O | ✅ In-memory | ✅ Indexed | ✅ Fast |
| Reliability | ⚠️ Merge risk | ✅ Atomic | ✅ ACID | ✅ Atomic |

---

## Decision 2: State Management Strategy

**Selected:** State Manager with Write-Through Caching

**Rationale:**
- **YAML as Authoritative Storage** — `sprint-status.yaml` is source of truth (BMAD-compatible, human-editable)
- **State Manager as Smart Cache** — In-memory cache for sub-millisecond reads (meets NFR-P7)
- **Write-Through Pattern** — Every cache write triggers YAML update immediately
- **Bidirectional Sync via File Watcher** — `fs.watch()` detects external YAML changes, updates cache
- **Optimistic Locking** — Version stamps prevent conflicts, retry on mismatch (FR41-FR44)
- **JSONL Audit Trail** — Every transition logged to `state-transitions.jsonl` (FR14, NFR-R8)
- **Graceful Degradation** — Fallback to direct YAML reads if cache unavailable (NFR-R3)

**Architecture:**
```
CLI/Dashboard ←SSE→ State Manager (In-Memory) ←Write-Through→ YAML Writer
                                           ↑                      ↓
Agent Coordinator → Events           Cache Layer          sprint-status.yaml
                                           ↓                      ↑
BMAD Tracker Plugin ← fs.watch() ← YAML Changes ← Human Edits
```

**Data Structures:**

**sprint-status.yaml format (extends BMAD):**
```yaml
version: 1
project: agent-orchestrator
sprint:
  id: sprint-23
  startDate: 2026-03-01
  endDate: 2026-03-15
stories:
  - id: story-001
    title: "Implement event bus"
    status: in_progress
    assignee: agent-1
    version: 5  # ← Optimistic locking version
    dependencies: [story-002]
    startedAt: 2026-03-05T10:30:00Z
    blocked: false
    blockedReason: null
```

**JSONL event log:**
```jsonl
{"timestamp":"2026-03-05T10:30:00Z","type":"story_started","storyId":"story-001","previousStatus":"backlog","newStatus":"in_progress","agent":"agent-1","version":5}
{"timestamp":"2026-03-05T10:35:00Z","type":"story_blocked","storyId":"story-001","reason":"API design unclear","agent":"agent-1","version":5}
```

**Implementation Interface:**

```typescript
// packages/core/src/services/state-manager.ts

export interface StateManager {
  // Read current state (from cache, sub-ms latency)
  getState(): Promise<ProjectState>;

  // Update story with optimistic locking
  updateStory(storyId: string, update: StoryUpdate, version: number): Promise<Story>;

  // Subscribe to state changes (for dashboard SSE)
  subscribe(callback: (state: ProjectState) => void): Disposable;

  // Handle external YAML changes (from file watcher)
  onYamlChanged(newYamlContent: string): Promise<void>;

  // Get conflict history for manual review
  getConflicts(since?: Date): Promise<Conflict[]>;
}

export class ConflictError extends Error {
  constructor(
    public storyId: string,
    public providedVersion: number,
    public currentVersion: number,
    public conflictingStates: { provided: Story; current: Story }
  ) {
    super(`Conflict updating story ${storyId}: version ${providedVersion} != ${currentVersion}`);
  }
}
```

**Affected Components:**
- State Manager Service (new in `packages/core/src/services/state-manager.ts`)
- BMAD Tracker Plugin (implements state synchronization)
- Agent Coordinator (updates story state via State Manager)
- Dashboard API (subscribes to state changes via SSE)
- CLI (reads from State Manager cache)

**Conflict Resolution Strategy:**
1. **Detect**: Version mismatch throws `ConflictError`
2. **Log**: Both versions logged to JSONL with timestamp
3. **Notify**: Human notified via configured notifier (desktop/Slack/webhook)
4. **Retry**: Auto-retry with latest version up to 3 times
5. **Escalate**: If retry fails, requires human judgment (FR44)

**Performance Characteristics:**
- **Read latency**: <1ms (in-memory cache)
- **Write latency**: <10ms (YAML write + cache update)
- **Sync latency**: <500ms (file watcher debounce)
- **Conflict rate**: Expected <1% in normal operation

**Why This Over Alternatives:**

| Concern | This Approach | Pure YAML | Pure DB |
|---------|--------------|-----------|---------|
| Performance | ✅ Sub-ms reads | ⚠️ File I/O on every access | ✅ Indexed queries |
| Human-editable | ✅ Yes | ✅ Yes | ❌ No |
| Conflict detection | ✅ Optimistic locking | ❌ Git merge conflicts | ✅ ACID |
| Complexity | ⚠️ Medium | ✅ Simplest | ❌ Complex |
| Reliability | ✅ Atomic + YAML backup | ⚠️ Corruption risk | ✅ ACID |
| BMAD integration | ✅ YAML-native | ✅ YAML-native | ❌ Requires sync |

---


## Decision 3: Multi-Agent Coordination

**Selected:** Hybrid Coordinator + Priority Queue

**Rationale:**
- **Priority Queue** — Natural backpressure, agents pull when ready
- **Coordinator Service** — Assigns from queue based on priority + agent availability
- **Redis-backed Queue** — Durable, survives restarts, cross-process
- **Conflict Prevention** — Pre-assignment check + real-time monitoring
- **Skill-Based Routing** — Optional tag matching for specialized agents

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Coordinator                         │
│                                                              │
│  ┌──────────────┐         ┌─────────────────┐               │
│  │   Priority   │◄────────┤  Story Queue    │               │
│  │   Scheduler  │ assign  │  (Redis Sorted  │               │
│  │              ├────────►│     Set)        │               │
│  └──────┬───────┘ claim   └─────────────────┘               │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │           Agent Registry (Redis Hash)                │    │
│  │  agent-1: {status: working, story: story-001}       │    │
│  │  agent-2: {status: idle, since: 10:30:00}           │    │
│  │  agent-3: {status: blocked, story: story-005}       │    │
│  └──────────────────────────────────────────────────────┘    │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │         Conflict Detector (Event Stream)             │    │
│  │  • Pre-assignment check (story already claimed?)     │    │
│  │  • Real-time monitoring (duplicate assignment?)       │    │
│  │  • Dependency resolution (unblock dependents)        │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Agent Lifecycle:**
```
Idle → Assigned → Working → Blocked → Completed → Idle
                ↓                    ↓
            Working          → Human Review → Resume → Working
```

**Implementation Interface:**

```typescript
// packages/core/src/services/agent-coordinator.ts

export interface AgentCoordinator {
  // Claim next available story (called by agent when idle)
  claimStory(agentId: string, capabilities?: string[]): Promise<StoryAssignment | null>;

  // Update agent status
  updateAgentStatus(agentId: string, status: AgentStatus, metadata?: AgentMetadata): Promise<void>;

  // Release story (completed or blocked)
  releaseStory(agentId: string, storyId: string, outcome: StoryOutcome): Promise<void>;

  // Resume blocked story after human intervention
  resumeStory(storyId: string): Promise<void>;

  // Get fleet status (for dashboard monitoring)
  getFleetStatus(): Promise<FleetStatus>;

  // Manually assign story to specific agent (FR7)
  assignStory(storyId: string, agentId: string): Promise<void>;
}

export interface StoryAssignment {
  storyId: string;
  story: Story;  // Full story context (title, description, acceptance criteria)
  priority: number;
  dependencies: string[];  // IDs of prerequisite stories
  estimatedPoints?: number;
}

export enum AgentStatus {
  IDLE = 'idle',
  ASSIGNED = 'assigned',
  WORKING = 'working',
  BLOCKED = 'blocked',
  OFFLINE = 'offline',
}

export enum StoryOutcome {
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

**Priority Queue Implementation (Redis Sorted Set):**

```typescript
// Story priority: higher number = higher priority
// Score = priority * 1000 + timestamp (for FIFO within priority)

await redis.zadd(
  'ao:story-queue',
  story.priority * 1000 + Date.now(),
  story.id
);

// Claim highest-priority available story
const [storyId] = await redis.zpopmax('ao:story-queue');
```

**Agent Registry (Redis Hash):**
```typescript
// Key: ao:agent:{agentId}
// Fields: status, currentStory, assignedAt, lastHeartbeat, capabilities

await redis.hset(`ao:agent:${agentId}`, {
  status: 'working',
  currentStory: 'story-001',
  assignedAt: Date.now(),
  lastHeartbeat: Date.now(),
  capabilities: 'typescript,react,api'
});
```

**Conflict Detection:**

1. **Pre-Assignment Check:**
   ```typescript
   // Check if story already assigned
   const assignedAgent = await redis.hget('ao:story-assignments', storyId);
   if (assignedAgent) {
     throw new ConflictError(storyId, assignedAgent);
   }
   ```

2. **Real-Time Monitoring:**
   ```typescript
   // Subscribe to assignment events via event bus
   eventBus.subscribe('story.assigned', (event) => {
     if (event.storyId === currentStory && event.agentId !== myAgentId) {
       // Conflict detected - release story
       coordinator.releaseStory(myAgentId, currentStory, 'conflict');
     }
   });
   ```

3. **Dependency Resolution (FR13):**
   ```typescript
   // When story completes, unblock dependents
   eventBus.subscribe('story.completed', async (event) => {
     const dependents = await stateManager.getDependentStories(event.storyId);
     for (const story of dependents) {
       if (await allDependenciesComplete(story)) {
         await storyQueue.add(story.id, story.priority);
       }
     }
   });
   ```

**Capacity Management:**

| Metric | Limit | Action |
|--------|-------|--------|
| **Max concurrent agents** | 10 (configurable) | Queue new assignments |
| **Agent heartbeat timeout** | 30s | Mark agent offline, reassign story |
| **Story completion timeout** | 2 hours | Mark story blocked, notify human |
| **Queue depth alert** | >20 stories | Notify tech lead (FR21) |

**Fleet Monitoring (FR26, FR29):**

```typescript
interface FleetStatus {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
  activeStories: number;
  blockedStories: number;
  queueDepth: number;
  averageCycleTime: number;  // minutes
  conflictsDetected: number;
}

// Update every 5 seconds via SSE (NFR-P5)
dashboard.broadcast({
  type: 'fleet-status',
  data: await coordinator.getFleetStatus(),
});
```

**Skill-Based Routing (Optional Enhancement):**

```typescript
// Story labels: ["typescript", "api", "authentication"]
// Agent capabilities: ["typescript", "react", "api"]

function matchScore(story: Story, agent: Agent): number {
  const storyTags = new Set(story.labels || []);
  const agentCaps = new Set(agent.capabilities || []);
  const intersection = [...storyTags].filter(tag => agentCaps.has(tag));
  return intersection.length;  // Higher = better match
}
```

**Resume Capability (FR8):**

```typescript
// Human reviews blocked story via CLI/dashboard
async resumeStory(storyId: string): Promise<void> {
  const story = await stateManager.getStory(storyId);

  // Clear blocked state
  story.blocked = false;
  story.blockedReason = null;
  story.status = 'ready';
  story.resumes++;

  // Re-add to queue with boosted priority
  await storyQueue.add(storyId, story.priority + 10);

  // Notify agent
  await eventBus.publish({
    type: 'story.resumed',
    storyId,
    previousAgent: story.assignee,
  });
}
```

**Deadlock Detection:**

```typescript
// Detect circular dependencies in story graph
async detectDeadlocks(): Promise<Deadlock[]> {
  const graph = buildDependencyGraph();
  const cycles = findCycles(graph);

  if (cycles.length > 0) {
    await notifier.notify({
      type: 'deadlock-detected',
      cycles,
      action: 'manual-intervention-required',
    });
  }

  return cycles;
}
```

**Performance Characteristics:**
- **Assignment latency**: <50ms (Redis ZPOP + HGET)
- **Conflict detection**: <10ms (pre-assignment check)
- **Fleet status update**: 5s interval (dashboard refresh)
- **Max agents**: 10+ concurrent without >10% degradation (NFR-SC1)

**Affected Components:**
- Agent Coordinator Service (new in `packages/core/src/services/agent-coordinator.ts`)
- Story Queue (Redis sorted set, new)
- Agent Registry (Redis hash, new)
- Dashboard API (fleet monitoring endpoint)
- CLI (manual assignment, resume commands)

**Phase 2 Enhancement (FR41-FR44):**
- Advanced conflict resolution with negotiation
- Agent specialization scores
- Predictive assignment based on historical performance

---

## Decision 4: CLI vs Dashboard Development Priority

**Selected:** CLI First — Full CLI, Dashboard Later

**Rationale:**
- **Existing CLI Infrastructure** — Commander.js already working, proven patterns
- **Faster MVP** — 9 days CLI vs 19 days Dashboard for core features
- **Terminal-Native Workflow** — Target users (developers) prefer terminal
- **Lower Complexity** — No UI state management, simpler testing
- **Dashboard Can Wait** — Real-time visualization is nice-to-have, not critical
- **CLI Independence** — Dashboard unavailable doesn't block operations (NFR-R2)

**Development Phases:**

**Phase 1 (CLI-First MVP - 2 weeks):**
```
Week 1: Core Commands
├── ao spawn --story <id> [--agent <id>]  # Spawn agent with story context
├── ao assign <story-id> <agent-id>      # Manual story assignment
├── ao status [story-id]                  # View story/agent status
├── ao fleet                              # List all agents and status
└── ao resume <story-id>                  # Resume blocked story

Week 2: Advanced Features
├── ao plan                               # Generate sprint plan
├── ao queue                              # View story queue
├── ao conflicts                          # Show conflict history
├── ao logs <agent-id>                    # View agent logs
└── ao health                             # System health check
```

**Phase 2 (Dashboard - Deferred to Sprint 2):**
- Fleet monitoring matrix with visual indicators
- Real-time burndown charts
- Agent session cards with drill-down
- In-app notifications center
- Drag-and-drop story assignment

**CLI Feature Completeness:**

| Feature | CLI Implementation | Priority |
|---------|-------------------|----------|
| Agent spawning (FR1-FR4) | `ao spawn --story story-001 --agent claude-1` | P0 |
| Story assignment (FR2, FR7) | `ao assign story-001 agent-1` | P0 |
| Agent status (FR5, FR6) | `ao status --agent agent-1` | P0 |
| Fleet monitoring (FR26) | `ao fleet` (table format) | P0 |
| Story queue (FR2) | `ao queue` (priority sorted) | P1 |
| Blocked resolution (FR8, FR35) | `ao resume story-001` | P0 |
| Sprint status (FR15) | `ao status --sprint` | P1 |
| Health check (FR29, NFR-R1) | `ao health` | P1 |
| Conflict history (FR44) | `ao conflicts --since 1d` | P2 |
| Agent logs (FR30) | `ao logs agent-1 --tail` | P2 |
| Burndown (FR25) | `ao burndown` (ASCII chart) | P2 |

**CLI Output Formats:**

```bash
# Fleet monitoring (FR26)
$ ao fleet
┌──────────┬─────────┬──────────┬─────────┬────────────┐
│ Agent    │ Status  │ Story    │ Runtime │ Last Seen  │
├──────────┼─────────┼──────────┼─────────┼────────────┤
│ claude-1 │ working │ story-001│ 45m     │ 10s ago    │
│ claude-2 │ idle    │ —        │ —       │ 5s ago     │
│ claude-3 │ blocked │ story-005│ 1h 20m  │ 30s ago    │
└──────────┴─────────┴──────────┴─────────┴────────────┘

# Story status (FR5, FR15)
$ ao status story-001
Story: story-001
Title: Implement event bus
Status: in_progress
Assignee: claude-1
Started: 2026-03-05 10:30:00
Runtime: 45 minutes
Dependencies: story-002 (✓ complete)

# Queue view
$ ao queue
Priority  Story ID  Title              Dependencies
────────────────────────────────────────────────────
P0        story-001 Implement event   story-002 ✓
P1        story-003 Add auth          story-001
P2        story-004 Fix bug           —
```

**Notification Integration (FR19-FR24):**

CLI relies on Notifier plugin for push notifications:
- **Desktop** — Native OS notifications (default)
- **Slack** — Webhook to configured channel
- **Webhook** — POST to configured endpoint
- **In-CLI** — Alert banners when agent blocks

```bash
# Notification appears when agent blocks
┌─────────────────────────────────────────────┐
│ ⚠️  AGENT BLOCKED                            │
│                                             │
│ Agent: claude-3                             │
│ Story: story-005 (Fix authentication bug)   │
│ Reason: API design unclear                  │
│                                             │
│ Run 'ao logs claude-3' for details          │
│ Run 'ao resume story-005' when ready        │
└─────────────────────────────────────────────┘
```

**Affected Components:**
- CLI Commands (extends `packages/cli/src/commands/`)
- Agent Coordinator (CLI commands call service)
- State Manager (CLI reads state for display)
- Notifier Plugin (push notifications for blocked agents)
- Dashboard API (minimal read-only endpoint, Phase 2)

**Dashboard Postponement:**
- Dashboard components deferred to Sprint 2
- Real-time SSE endpoint still implemented (for CLI monitoring mode)
- Dashboard API remains read-only for basic fleet status
- Full dashboard UI built after CLI validation

**Benefits of CLI-First:**
1. **Rapid Validation** — Test workflows with real users before building UI
2. **Lower Risk** — Simpler codebase, fewer bugs, easier debugging
3. **Developer-Friendly** — Target audience comfortable with terminal
4. **Scriptable** — Easy to automate and integrate with CI/CD
5. **Foundation for Dashboard** — CLI commands can power dashboard backend

**Risks and Mitigations:**

| Risk | Mitigation |
|------|------------|
| Limited fleet visibility | Rich `ao fleet` table with color-coded status |
| No burndown visualization | ASCII burndown chart in CLI |
| Hard to spot patterns | `ao conflicts` and `ao health` for insights |
| New user onboarding | Comprehensive `--help` and examples |

---

## Decision 5: Notification System

**Selected:** Hybrid Notification Service + Plugin-Based Delivery

**Rationale:**
- **Notification Service** — Central queue, deduplication, persistence, routing logic
- **Plugin Delivery** — Each notifier plugin handles its own delivery mechanism
- **Guaranteed Delivery** — Service queues notifications until acknowledged
- **Event-Driven** — Subscribes to event bus for notification triggers
- **Fits Architecture** — Extends existing Notifier slot (8-slot plugin system)
- **Configurable Preferences** — Per-type rules, channel selection, digest batching

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                   Notification Service                       │
│                                                              │
│  ┌──────────────┐         ┌─────────────────┐               │
│  │   Event      │────────►│  Notification   │               │
│  │   Stream     │ subscribe│    Queue        │               │
│  │              │         │  (Redis List)   │               │
│  └──────────────┘         └────────┬────────┘               │
│                                    │                         │
│                           ┌────────▼────────┐                │
│                           │   Deduplicator  │                │
│                           │  (Sliding Win)  │                │
│                           └────────┬────────┘                │
│                                    │                         │
│                           ┌────────▼────────┐                │
│                           │    Router       │                │
│                           │ (by preference) │                │
│                           └────────┬────────┘                │
│                                    │                         │
│     ┌──────────────────────────────┼──────────────────────┐ │
│     │                              │                      │ │
│     ▼                              ▼                      ▼ ▼
│  Desktop Notifier              Slack Notifier         Webhook Notifier
│  (node-notifier)               (Webhook POST)         (HTTP POST)
```

**Notification Triggers:**

| Event Type | Priority | Notification | Dedup Window |
|------------|----------|--------------|---------------|
| Agent blocked (FR33) | Critical | Immediate push | 5 min |
| Conflict detected (FR41) | High | Immediate push | 10 min |
| Agent offline >30s (FR29) | High | Immediate push | 5 min |
| Event bus backlog (FR21) | Critical | Immediate push | 10 min |
| Queue depth >20 (FR21) | Medium | Digest every 30 min | 30 min |
| Story completed (FR6) | Low | Log only | — |
| Sprint burndown updated (FR25) | Low | Real-time update | — |

**Implementation Interface:**

```typescript
// packages/core/src/services/notification-service.ts

export interface NotificationService {
  // Enqueue notification for delivery
  send(notification: Notification): Promise<void>;

  // Subscribe to notification stream (for dashboard)
  subscribe(callback: (notification: Notification) => void): Disposable;

  // Get notification history
  getHistory(since?: Date, filter?: NotificationFilter): Promise<Notification[]>;

  // Mark notification as acknowledged
  acknowledge(id: string): Promise<void>;

  // Configure user preferences
  setPreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
  acknowledged?: boolean;
}

export enum NotificationType {
  AGENT_BLOCKED = 'agent.blocked',
  CONFLICT_DETECTED = 'conflict.detected',
  STORY_COMPLETED = 'story.completed',
  AGENT_OFFLINE = 'agent.offline',
  QUEUE_DEPTH_ALERT = 'queue.depth',
  EVENT_BUS_BACKLOG = 'eventbus.backlog',
  SPRINT_BURNDOWN = 'sprint.burndown',
}

export enum NotificationPriority {
  CRITICAL = 'critical',  // Immediate push, all channels
  HIGH = 'high',          // Immediate push, primary channel
  MEDIUM = 'medium',      // Digest every 30 min
  LOW = 'low',            // Log only
}
```

**Deduplication Strategy:**

```typescript
// Sliding window deduplication
// Key: notif:{type}:{entityId}
// TTL: Configurable per notification type (5-30 min)

async function isDuplicate(notification: Notification): Promise<boolean> {
  const key = `notif:${notification.type}:${notification.metadata.storyId || notification.metadata.agentId}`;
  const exists = await redis.exists(key);
  
  if (!exists) {
    await redis.setex(key, DEDUP_WINDOW[notification.type], '1');
    return false;
  }
  
  return true;
}

const DEDUP_WINDOW = {
  [NotificationType.AGENT_BLOCKED]: 300,      // 5 min
  [NotificationType.CONFLICT_DETECTED]: 600,  // 10 min
  [NotificationType.QUEUE_DEPTH_ALERT]: 1800, // 30 min
  [NotificationType.AGENT_OFFLINE]: 300,      // 5 min
};
```

**Notifier Plugin Interface:**

```typescript
// packages/core/src/types.ts (extends existing Notifier interface)

export interface Notifier {
  name: string;

  // Send notification (called by NotificationService)
  send(notification: Notification): Promise<void>;

  // Health check
  health(): Promise<HealthStatus>;

  // Configuration validation
  validateConfig(config: unknown): Promise<boolean>;
}
```

**Notifier Plugin Implementations:**

| Plugin | Status | Implementation | Delivery Mechanism |
|--------|--------|----------------|-------------------|
| **Desktop** | ✅ Exists | `node-notifier` package | Native OS notifications |
| **Slack** | ✅ Exists | Webhook POST | Slack channel message |
| **Webhook** | ✅ Exists | HTTP POST with headers | Generic integration |
| **Terminal** | ⚠️ Enhanced | In-CLI banners | stdout/stderr output |
| **Email** | Phase 3 | SMTP or SendGrid | Email delivery |
| **Discord** | Phase 3 | Webhook to Discord | Discord channel message |

**Notification Preferences (FR22):**

```yaml
# agent-orchestrator.yaml

notifications:
  enabled: true
  preferences:
    channels:
      desktop: true
      slack: true
      webhook: false
    
    # Per-type rules
    rules:
      - type: agent.blocked
        enabled: true
        channels: [desktop, slack]
        priority: critical
      
      - type: conflict.detected
        enabled: true
        channels: [desktop, slack]
        priority: high
      
      - type: story.completed
        enabled: false  # Log only
        priority: low
      
      - type: queue.depth
        enabled: true
        channels: [slack]
        priority: medium
        digest: 30m  # Batch every 30 minutes

  slack:
    webhookUrl: ${SLACK_WEBHOOK_URL}
    channel: '#devops-alerts'
    username: 'Agent Orchestrator'
    iconEmoji: ':robot_face:'

  webhook:
    url: ${WEBHOOK_URL}
    headers:
      Authorization: 'Bearer ${WEBHOOK_TOKEN}'
      Content-Type: 'application/json'

  desktop:
    sound: true  # Play notification sound
```

**Notification Service Implementation:**

```typescript
// packages/core/src/services/notification-service.ts

export class NotificationServiceImpl implements NotificationService {
  constructor(
    private eventBus: EventBus,
    private notifiers: Notifier[],
    private redis: Redis,
  ) {
    this.subscribeToEvents();
  }

  async send(notification: Notification): Promise<void> {
    // Check deduplication
    if (await this.isDuplicate(notification)) {
      return;
    }

    // Persist to queue
    await this.redis.rpush('ao:notifications', JSON.stringify(notification));

    // Persist to history
    await this.redis.rpush(
      'ao:notifications:history',
      JSON.stringify(notification)
    );
    await redis.ltrim('ao:notifications:history', -1000, -1);

    // Route to appropriate notifiers
    await this.route(notification);
  }

  private async route(notification: Notification): Promise<void> {
    const prefs = await this.getPreferences();
    const enabledNotifiers = this.notifiers.filter(n => 
      prefs.channels[n.name] && this.shouldNotify(n, notification)
    );

    await Promise.allSettled(
      enabledNotifiers.map(n => n.send(notification))
    );
  }

  private subscribeToEvents(): void {
    // Agent blocked (FR33)
    this.eventBus.subscribe('agent.blocked', async (event) => {
      await this.send({
        id: nanoid(),
        type: NotificationType.AGENT_BLOCKED,
        priority: NotificationPriority.CRITICAL,
        title: 'Agent Blocked',
        message: `Agent ${event.agentId} blocked on ${event.storyId}: ${event.reason}`,
        metadata: event,
        createdAt: new Date(),
      });
    });

    // Conflict detected (FR41)
    this.eventBus.subscribe('conflict.detected', async (event) => {
      await this.send({
        id: nanoid(),
        type: NotificationType.CONFLICT_DETECTED,
        priority: NotificationPriority.HIGH,
        title: 'Conflict Detected',
        message: `Multiple agents assigned to ${event.storyId}`,
        metadata: event,
        createdAt: new Date(),
      });
    });

    // Queue depth alert (FR21)
    this.eventBus.subscribe('queue.depth.exceeded', async (event) => {
      await this.send({
        id: nanoid(),
        type: NotificationType.QUEUE_DEPTH_ALERT,
        priority: NotificationPriority.MEDIUM,
        title: 'Queue Depth Alert',
        message: `${event.depth} stories in queue (threshold: ${event.threshold})`,
        metadata: event,
        createdAt: new Date(),
      });
    });

    // Agent offline (FR29)
    this.eventBus.subscribe('agent.offline', async (event) => {
      await this.send({
        id: nanoid(),
        type: NotificationType.AGENT_OFFLINE,
        priority: NotificationPriority.HIGH,
        title: 'Agent Offline',
        message: `Agent ${event.agentId} offline for ${event.duration}s`,
        metadata: event,
        createdAt: new Date(),
      });
    });

    // Event bus backlog (FR21)
    this.eventBus.subscribe('eventbus.backlog', async (event) => {
      await this.send({
        id: nanoid(),
        type: NotificationType.EVENT_BUS_BACKLOG,
        priority: NotificationPriority.CRITICAL,
        title: 'Event Bus Backlog',
        message: `Event bus backlog: ${event.backlogSize} events (threshold: ${event.threshold})`,
        metadata: event,
        createdAt: new Date(),
      });
    });
  }

  async getHistory(since?: Date, filter?: NotificationFilter): Promise<Notification[]> {
    const notifications = await this.redis.lrange('ao:notifications:history', 0, -1);
    let parsed = notifications.map(n => JSON.parse(n));

    if (since) {
      parsed = parsed.filter(n => new Date(n.createdAt) >= since);
    }

    if (filter) {
      parsed = parsed.filter(n => 
        (!filter.type || n.type === filter.type) &&
        (!filter.priority || n.priority === filter.priority)
      );
    }

    return parsed;
  }
}
```

**Persistence (FR24):**

```typescript
// Notification history stored in Redis list
// Key: ao:notifications:history
// Retention: 7 days (configurable), max 1000 notifications

await redis.rpush('ao:notifications:history', JSON.stringify(notification));
await redis.ltrim('ao:notifications:history', -1000, -1);
```

**Terminal Notification Enhancement:**

```bash
# CLI notification banner
$ ao notifications stream
Listening for notifications...

┌─────────────────────────────────────────────┐
│ 🔴 CRITICAL: Agent Blocked                   │
│                                              │
│ Agent: claude-3                              │
│ Story: story-005 (Fix auth bug)             │
│ Reason: API design unclear                   │
│ Time: 2026-03-05 10:35:00 UTC               │
│                                              │
│ Actions:                                     │
│   ao logs claude-3      View agent logs      │
│   ao resume story-005   Resume story         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ⚠️  HIGH: Conflict Detected                  │
│                                              │
│ Story: story-001                             │
│ Agents: claude-1, claude-2                   │
│ Time: 2026-03-05 10:36:00 UTC               │
│                                              │
│ Action: ao conflicts --resolve               │
└─────────────────────────────────────────────┘
```

**Affected Components:**
- Notification Service (new in `packages/core/src/services/notification-service.ts`)
- Notifier Plugins (Desktop, Slack, Webhook, Terminal enhancement)
- Configuration (notification preferences in `agent-orchestrator.yaml`)
- CLI Commands (`ao notifications history`, `ao notifications prefs`, `ao notifications stream`)
- Dashboard API (notifications endpoint for in-app display, Phase 2)

**Performance Characteristics:**
- **Notification latency**: <1s (Redis queue → notifier delivery)
- **Deduplication check**: <5ms (Redis EXISTS)
- **History query**: <100ms (Redis LRANGE)
- **Max throughput**: 1000 notifications/second
- **Persistence**: 7-day retention, 1000 notification limit

**Phase 3 Enhancements:**
- Email notifier (SMTP/SendGrid)
- Discord notifier (webhook)
- Notification templates and customization
- Notification aggregation (digest mode)
- Multi-tenant notifications (per-project preferences)

---

## Decision 6: Error Handling & Recovery Patterns

**Selected:** Layered Approach — Core Error Handler + Service-Specific Extensions

**Rationale:**
- **Core Error Handler** — Consistent logging, retry logic, notification, circuit breaker
- **Service Extensions** — Service-specific recovery (YAML backup, Redis reconnection, agent reassignment)
- **Circuit Breaker Integration** — Prevents cascade failures (5 failures → open 30s)
- **Graceful Degradation** — Queue operations when services unavailable
- **99.5% Uptime Target** (NFR-R1) — Watchdog restart, health monitoring, automatic recovery

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Core Error Handler                        │
│                                                              │
│  ┌──────────────┐         ┌─────────────────┐               │
│  │   Error      │────────►│  Logger         │               │
│  │   Collector  │ capture  │  (JSONL)        │               │
│  │              │         │                 │               │
│  └──────┬───────┘         └─────────────────┘               │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │              Error Classifier                        │    │
│  │  • Transient → Retry with backoff                    │    │
│  │  • Service Unavailable → Queue & degrade             │    │
│  │  • Data Corruption → Backup restore                  │    │
│  │  • Agent Failure → Reassign & notify                 │    │
│  └──────────────────────────────────────────────────────┘    │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │              Recovery Coordinator                    │    │
│  │  • Exponential backoff (1s, 2s, 4s, 8s, 16s)         │    │
│  │  • Circuit breaker (5 failures → open 30s)          │    │
│  │  • Dead letter queue after 5 retries                │    │
│  │  • Human notification for unhandled errors          │    │
│  └──────────────────────────────────────────────────────┘    │
│         │                                                      │
│         │ Service-specific handlers                          │
│         ▼                                                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐     │
│  │ State        │  │ Event Bus   │  │ Agent            │     │
│  │ Manager      │  │             │  │ Coordinator      │     │
│  │              │  │             │  │                  │     │
│  │ • YAML       │  │ • Reconnect │  │ • Reassign story │     │
│  │   backup     │  │ • Flush     │  │ • Timeout        │     │
│  │ • Validate   │  │ • Local     │  │ • Notify human   │     │
│  │   schema     │  │   queue     │  │                  │     │
│  └──────────────┘  └─────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Error Categories & Recovery:**

| Category | Examples | Impact | Recovery Strategy |
|----------|----------|--------|-------------------|
| **Transient** | Network timeout, rate limit | Temporary degradation | Retry with exponential backoff |
| **Service Unavailable** | BMAD down, Redis disconnected | Degraded mode | Queue operations, retry when restored |
| **Data Corruption** | Invalid YAML, parse error | State inconsistency | Restore from backup, notify human |
| **Agent Failure** | Agent crash, process timeout | Story blocked | Reassign story, notify human |
| **Resource Exhaustion** | Memory limit, disk full | System throttling | Alert, pause new operations |

**Implementation Interface:**

```typescript
// packages/core/src/services/error-handler.ts

export interface ErrorHandler {
  // Handle error with automatic recovery
  handle(error: Error, context: ErrorContext): Promise<ErrorResult>;

  // Register service-specific handler
  registerHandler(service: string, handler: ServiceErrorHandler): void;

  // Get error statistics
  getStats(): Promise<ErrorStats>;

  // Get dead letter queue (failed operations)
  getDeadLetterQueue(): Promise<FailedOperation[]>;

  // Retry failed operation from DLQ
  retry(operationId: string): Promise<void>;
}

export interface ErrorContext {
  service: string;
  operation: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ErrorResult {
  handled: boolean;
  recovered: boolean;
  action: 'retry' | 'queue' | 'notify' | 'ignore';
  retryAt?: Date;
}

export abstract class ServiceErrorHandler {
  abstract shouldRetry(error: Error): boolean;
  abstract maxRetries(): number;
  abstract recover(error: Error, context: ErrorContext): Promise<void>;
  abstract onFinalFailure(error: Error, context: ErrorContext): Promise<void>;
}
```

**Error Classification & Routing:**

```typescript
// packages/core/src/services/error-handler.ts

export class ErrorHandlerImpl implements ErrorHandler {
  async handle(error: Error, context: ErrorContext): Promise<ErrorResult> {
    // Log error to JSONL
    await this.logError(error, context);

    // Classify error
    const classification = this.classify(error);

    // Route to recovery strategy
    switch (classification) {
      case ErrorType.TRANSIENT:
        return await this.handleTransient(error, context);
      
      case ErrorType.SERVICE_UNAVAILABLE:
        return await this.handleServiceUnavailable(error, context);
      
      case ErrorType.DATA_CORRUPTION:
        return await this.handleDataCorruption(error, context);
      
      case ErrorType.AGENT_FAILURE:
        return await this.handleAgentFailure(error, context);
      
      default:
        return await this.handleUnknown(error, context);
    }
  }

  private async handleTransient(error: Error, context: ErrorContext): Promise<ErrorResult> {
    const handler = this.handlers.get(context.service);
    const maxRetries = handler?.maxRetries() ?? 5;

    // Check retry count
    const retryCount = await this.getRetryCount(context);
    if (retryCount >= maxRetries) {
      await this.moveToDeadLetterQueue(error, context);
      await this.notifyHuman(error, context);
      return { handled: true, recovered: false, action: 'notify' };
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.pow(2, retryCount) * 1000;
    await this.scheduleRetry(context, delay);

    return { handled: true, recovered: false, action: 'retry', retryAt: new Date(Date.now() + delay) };
  }

  private async handleServiceUnavailable(error: Error, context: ErrorContext): Promise<ErrorResult> {
    // Queue operation for later retry
    await this.queueOperation(context);

    // Notify human if backlog exceeds threshold (FR21)
    const backlogSize = await this.getBacklogSize();
    if (backlogSize > 100) {
      await this.notifyHuman(error, context, 'backlog-exceeded');
    }

    return { handled: true, recovered: true, action: 'queue' };
  }

  private async handleDataCorruption(error: Error, context: ErrorContext): Promise<ErrorResult> {
    // Attempt backup restore (FR40)
    const restored = await this.backupManager.restore(context.entityId);

    if (restored) {
      await this.logInfo('Restored from backup', context);
      return { handled: true, recovered: true, action: 'ignore' };
    }

    // Notify human for manual intervention
    await this.notifyHuman(error, context, 'data-corruption');
    return { handled: true, recovered: false, action: 'notify' };
  }

  private async handleAgentFailure(error: Error, context: ErrorContext): Promise<ErrorResult> {
    // Reassign story to another agent
    const storyId = context.metadata?.storyId as string;
    if (storyId) {
      await this.agentCoordinator.releaseStory(context.entityId, storyId, 'failed');
      await this.notifyHuman(error, context, 'agent-failure');
    }

    return { handled: true, recovered: true, action: 'notify' };
  }
}
```

**Circuit Breaker Pattern:**

```typescript
// packages/core/src/services/circuit-breaker.ts

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,      // Open after 5 failures
    private timeout = 30000,    // Try again after 30s
    private service: string
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError(this.service);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker opened for ${this.service}`);
    }
  }
}
```

**Service-Specific Handlers:**

**State Manager Handler:**

```typescript
// packages/core/src/services/state-manager/error-handler.ts

export class StateManagerErrorHandler extends ServiceErrorHandler {
  constructor(private backupManager: BackupManager) {
    super();
  }

  shouldRetry(error: Error): boolean {
    return error instanceof YAMLParseError || this.isFileLockError(error);
  }

  maxRetries(): number {
    return 3;
  }

  async recover(error: Error, context: ErrorContext): Promise<void> {
    if (error instanceof YAMLParseError) {
      await this.backupManager.restore(context.entityId);
    }

    if (this.isFileLockError(error)) {
      await sleep(1000); // Wait for lock release
    }
  }

  async onFinalFailure(error: Error, context: ErrorContext): Promise<void> {
    await notificationService.send({
      type: NotificationType.DATA_CORRUPTION,
      priority: NotificationPriority.CRITICAL,
      title: 'State Manager Error',
      message: `Failed to update state: ${error.message}`,
      metadata: { error, context },
    });
  }
}
```

**Event Bus Handler:**

```typescript
// packages/core/src/services/event-bus/error-handler.ts

export class EventBusErrorHandler extends ServiceErrorHandler {
  constructor(private redis: Redis, private localQueue: LocalEventQueue) {
    super();
  }

  shouldRetry(error: Error): boolean {
    return this.isRedisConnectionError(error);
  }

  maxRetries(): number {
    return 10; // Keep trying, queue locally
  }

  async recover(error: Error, context: ErrorContext): Promise<void> {
    // Queue events locally until Redis reconnects
    await this.localQueue.push(context.metadata?.event);
  }

  async onFinalFailure(error: Error, context: ErrorContext): Promise<void> {
    // Flush local queue when Redis reconnects
    await this.flushLocalQueue();
  }
}
```

**Health Monitoring (FR29, FR39):**

```typescript
// packages/core/src/services/health-monitor.ts

export interface HealthCheckConfig {
  serviceName: string;
  interval: number;        // Check interval (ms)
  timeout: number;         // Timeout (ms)
  failureThreshold: number; // Alert after N failures
  recoveryThreshold: number; // Healthy after N successes
}

export class HealthMonitor {
  private checkResults = new Map<string, HealthStatus>();

  async register(config: HealthCheckConfig): Promise<void> {
    setInterval(async () => {
      const status = await this.check(config);
      this.checkResults.set(config.serviceName, status);

      if (status.status === 'unhealthy' && status.failureCount >= config.failureThreshold) {
        await this.alert(config.serviceName, status);
      }
    }, config.interval);
  }

  private async check(config: HealthCheckConfig): Promise<HealthStatus> {
    try {
      const result = await Promise.race([
        this.performCheck(config.serviceName),
        sleep(config.timeout).then(() => { throw new TimeoutError(); }),
      ]);

      return { status: 'healthy', lastCheck: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error, lastCheck: new Date() };
    }
  }
}
```

**Graceful Degradation (FR34, NFR-R3):**

```typescript
// Degraded mode when BMAD tracker unavailable

export class StateManager {
  private isDegraded = false;
  private queuedUpdates: StoryUpdate[] = [];

  async updateStory(storyId: string, update: StoryUpdate): Promise<Story> {
    try {
      return await this.writeToYAML(storyId, update);
    } catch (error) {
      if (this.isBMADUnavailable(error)) {
        this.isDegraded = true;
        
        // Queue update in memory
        this.queuedUpdates.push({ storyId, update });
        
        // Notify of degraded mode
        await this.notifyDegraded();
        
        // Return cached state
        return this.getCachedStory(storyId);
      }
      throw error;
    }
  }

  private async notifyDegraded(): Promise<void> {
    await notificationService.send({
      type: NotificationType.SERVICE_UNAVAILABLE,
      priority: NotificationPriority.HIGH,
      title: 'Degraded Mode',
      message: 'BMAD tracker unavailable, queuing updates',
    });
  }

  async onBMADRestored(): Promise<void> {
    this.isDegraded = false;
    
    // Flush queued updates
    for (const { storyId, update } of this.queuedUpdates) {
      await this.writeToYAML(storyId, update);
    }
    
    this.queuedUpdates = [];
  }
}
```

**Data Corruption Detection (FR40):**

```typescript
// packages/core/src/services/backup-manager.ts

export class BackupManager {
  async validateState(yamlContent: string): Promise<boolean> {
    try {
      // Parse YAML
      const parsed = yaml.parse(yamlContent);
      
      // Validate schema
      await stateSchema.validateAsync(parsed);
      
      // Check version
      if (parsed.version !== 1) {
        throw new Error(`Invalid version: ${parsed.version}`);
      }

      return true;
    } catch (error) {
      console.error('State validation failed:', error);
      return false;
    }
  }

  async createBackup(): Promise<void> {
    const content = await fs.readFile(yamlPath, 'utf-8');
    
    // Create backup with timestamp
    const backupPath = `${yamlPath}.backup.${Date.now()}`;
    await fs.writeFile(backupPath, content);

    // Keep last 10 backups
    await this.cleanupOldBackups(10);
  }

  async restore(entityId?: string): Promise<boolean> {
    const backups = await this.listBackups();
    const latestBackup = backups[0];

    if (!latestBackup) {
      return false;
    }

    await fs.copyFile(latestBackup.path, yamlPath);
    console.info(`Restored from backup: ${latestBackup.path}`);
    
    return true;
  }

  private async listBackups(): Promise<BackupInfo[]> {
    const files = await fs.readdir(yamlDir);
    const backups = files.filter(f => f.includes('.backup.'));
    
    return backups.map(f => ({
      path: path.join(yamlDir, f),
      timestamp: parseInt(f.split('.backup.')[1]),
    })).sort((a, b) => b.timestamp - a.timestamp);
  }
}
```

**Watchdog Process:**

```typescript
// packages/core/src/watchdog.ts

export class Watchdog {
  private processes = new Map<string, ManagedProcess>();
  private restartCounts = new Map<string, number>();

  async register(name: string, process: ManagedProcess): Promise<void> {
    this.processes.set(name, process);

    // Monitor process
    process.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Process ${name} exited with code ${code}`);
        this.restart(name);
      }
    });
  }

  private async restart(name: string): Promise<void> {
    const process = this.processes.get(name);
    if (!process) return;

    // Increment restart count
    const count = (this.restartCounts.get(name) || 0) + 1;
    this.restartCounts.set(name, count);

    // Exponential backoff for restarts
    const delay = Math.pow(2, count) * 1000; // 1s, 2s, 4s, 8s, 16s
    
    console.info(`Restarting process ${name} in ${delay}ms (attempt ${count})`);
    
    await sleep(delay);
    
    // Restart process
    const newProcess = spawn(process.command, process.args);
    this.register(name, newProcess);
  }
}
```

**CLI Commands:**

```bash
# Health check (FR29)
$ ao health
┌──────────────────────┬──────────┬────────────────┐
│ Service             │ Status   │ Last Checked   │
├──────────────────────┼──────────┼────────────────┤
│ State Manager       │ healthy  │ 10:30:00       │
│ Event Bus           │ healthy  │ 10:30:00       │
│ Agent Coordinator   │ healthy  │ 10:30:00       │
│ Notification Svc    │ healthy  │ 10:30:00       │
│ BMAD Tracker        │ degraded │ 10:28:30       │
└──────────────────────┴──────────┴────────────────┘

# Error history
$ ao errors --since 1h
┌────────────────────────────────────────────────────────────┐
│ 10:35:00 [agent-coordinator] agent.blocked                 │
│   Agent: claude-3, Story: story-005                        │
│   Action: Notified human, queued for retry                 │
├────────────────────────────────────────────────────────────┤
│ 10:32:00 [state-manager] yaml.parse_error                  │
│   Restored from backup: story-001.backup.1741123120000     │
│   Action: Recovered automatically                          │
├────────────────────────────────────────────────────────────┤
│ 10:25:00 [event-bus] redis.connection_error                │
│   Queued 12 events locally                                 │
│   Action: Will retry when Redis reconnects                 │
└────────────────────────────────────────────────────────────┘

# Dead letter queue
$ ao dlq
┌────────────────────────────────────────────────────────────┐
│ Dead Letter Queue (3 operations)                           │
├────────────────────────────────────────────────────────────┤
│ 1. story-001.update (failed 5 times)                       │
│    Error: YAML lock timeout                                │
│    Action: ao dlq retry 1                                  │
├────────────────────────────────────────────────────────────┤
│ 2. event-bus.publish (failed 10 times)                     │
│    Error: Redis disconnected                               │
│    Action: Waiting for reconnection                        │
└────────────────────────────────────────────────────────────┘
```

**Affected Components:**
- Core Error Handler (new in `packages/core/src/services/error-handler.ts`)
- Circuit Breaker (new in `packages/core/src/services/circuit-breaker.ts`)
- Health Monitor (new in `packages/core/src/services/health-monitor.ts`)
- Backup Manager (new in `packages/core/src/backup-manager.ts`)
- Watchdog (new in `packages/core/src/watchdog.ts`)
- Service-Specific Handlers (State Manager, Event Bus, Agent Coordinator)
- CLI Commands (`ao health`, `ao errors`, `ao dlq`)

**Performance Characteristics:**
- **Error handling latency**: <10ms (classification + routing)
- **Circuit breaker overhead**: <1ms (state check)
- **Health check interval**: 30s (configurable per service)
- **Backup creation**: <100ms (file copy + validation)
- **Watchdog restart delay**: 1s, 2s, 4s, 8s, 16s (exponential)

**Error Handling Principles:**
1. **Never Crash Core Process** — Plugin failures isolated (NFR-I2)
2. **Log Everything** — JSONL audit trail for troubleshooting (FR37, NFR-R8)
3. **Retry with Backoff** — Exponential backoff for transient failures (FR38)
4. **Graceful Degradation** — Queue operations when services unavailable (FR34, NFR-R3)
5. **Notify Human** — Alert when judgment required (FR20)
6. **Recover Automatically** — Watchdog restart, backup restore, queue flush
7. **Preserve State** — Zero data loss through JSONL + backups (NFR-R5)

---

---

# Architecture Summary

## Overview

This architecture document defines the technical decisions for extending Agent Orchestrator with BMAD workflow orchestration capabilities. The design builds on the existing 8-slot plugin system, adding services for state management, multi-agent coordination, event distribution, notifications, and error handling.

## Core Architectural Decisions

| # | Decision | Selection | Key Impact |
|---|----------|-----------|------------|
| **1** | **Event Bus** | Redis Pub/Sub | Cross-process event distribution, durable persistence, sub-ms latency |
| **2** | **State Management** | Write-Through Cache | YAML as source, in-memory cache, optimistic locking, bidirectional sync |
| **3** | **Agent Coordination** | Hybrid Coordinator + Priority Queue | Redis-backed queue, conflict detection, dependency resolution, skill routing |
| **4** | **Development Priority** | CLI First | 2-week CLI MVP, dashboard deferred to Sprint 2 |
| **5** | **Notification System** | Hybrid Service + Plugins | Central queue, deduplication, plugin-based delivery |
| **6** | **Error Handling** | Layered Handler + Extensions | Core handler with service-specific recovery, circuit breaker, graceful degradation |

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Orchestrator                              │
│                                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │    CLI     │  │  Dashboard   │  │ Agent           │  │  BMAD     │ │
│  │            │  │  (Phase 2)   │  │ Coordinator     │  │  Tracker  │ │
│  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  └─────┬─────┘ │
│        │                │                   │                  │       │
│        │ SSE            │ SSE               │                  │       │
│        ▼                ▼                   ▼                  ▼       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Service Layer                                │  │
│  │                                                                  │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────┐ │  │
│  │  │   State     │ │   Event      │ │  Agent      │ │ Notify    │ │  │
│  │  │   Manager   │ │    Bus       │ │ Coordinator │ │  Service  │ │  │
│  │  │             │ │              │ │             │ │           │ │  │
│  │  │ • Cache     │ │ • Pub/Sub   │ │ • Queue     │ │ • Queue   │ │  │
│  │  │ • YAML sync │ │ • Dedup     │ │ • Registry  │ │ • Dedup   │ │  │
│  │  │ • Locking   │ │ • Persist   │ │ • Conflict  │ │ • Route   │ │  │
│  │  └─────────────┘ └──────────────┘ └─────────────┘ └───────────┘ │  │
│  │                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐    │  │
│  │  │               Error Handler + Circuit Breaker           │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                 │
│                                    ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      Data Layer                                 │  │
│  │                                                                  │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐   │  │
│  │  │  Redis  │  │   YAML   │  │   JSONL    │  │   Backup     │   │  │
│  │  │         │  │sprint-   │  │   Event    │  │   Files      │   │  │
│  │  │ • Queue │  │  status  │  │   Log      │  │              │   │  │
│  │  │ • Pub   │  │          │  │            │  │ • Restore    │   │  │
│  │  │   /Sub  │  │ • State  │  │ • Audit    │  │ • Validate   │   │  │
│  │  │ • Cache │  │          │  │            │  │              │   │  │
│  │  └─────────┘  └──────────┘  └────────────┘  └──────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      Plugin Layer (8-slot)                       │  │
│  │                                                                  │  │
│  │  Runtime   │ Agent     │ Workspace │ Tracker │ SCM   │ Notifier │  │
│  │  (tmux)    │(claude)   │ (worktree)│ (BMAD)  │(git) │(desktop) │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Event Bus** | Redis Pub/Sub | Cross-process, durable, fast |
| **State Cache** | In-memory + Redis | Sub-ms reads, distributed support |
| **Story Queue** | Redis Sorted Set | O(log n) priority ops, durable |
| **Agent Registry** | Redis Hash | Fast lookups, TTL support |
| **State Storage** | YAML file (BMAD) | Human-editable, git-tracked |
| **Audit Trail** | JSONL file | Append-only, parseable |
| **CLI** | Commander.js | Existing infrastructure |
| **Dashboard** | Next.js 15 + React 19 | Existing infrastructure |
| **Language** | TypeScript 5.7 | Type safety, plugin interfaces |
| **Runtime** | Node.js 20+ | ESM, plugin system |

## New Services to Implement

| Service | Package | Interface | Dependencies |
|---------|---------|-----------|--------------|
| **Event Bus** | `@composio/ao-core` | `EventBus` | Redis (ioredis) |
| **State Manager** | `@composio/ao-core` | `StateManager` | File system, Redis |
| **Agent Coordinator** | `@composio/ao-core` | `AgentCoordinator` | Redis, State Manager |
| **Notification Service** | `@composio/ao-core` | `NotificationService` | Redis, Notifier plugins |
| **Error Handler** | `@composio/ao-core` | `ErrorHandler` | All services |
| **Circuit Breaker** | `@composio/ao-core` | `CircuitBreaker` | — |
| **Health Monitor** | `@composio/ao-core` | `HealthMonitor` | All services |
| **Backup Manager** | `@composio/ao-core` | `BackupManager` | File system |

## Performance Targets

| Metric | Target | How Achieved |
|--------|--------|--------------|
| **State sync latency** | ≤5s (p95) | File watcher + write-through cache |
| **Event latency** | ≤500ms (p95) | Redis pub/sub |
| **Agent spawn time** | ≤10s | tmux plugin optimization |
| **CLI response** | ≤500ms | In-memory cache |
| **Dashboard load** | ≤2s | Server-side rendering |
| **Event throughput** | 100+ events/sec | Redis pub/sub |
| **Burst capacity** | 1000 events in 10s | Redis queue |
| **Concurrent agents** | 10+ (≤10% degradation) | Priority queue, async ops |

## Development Roadmap

### Phase 1 (Sprint 1): CLI-First MVP - 2 weeks

**Week 1: Core Services**
- Event Bus (Redis pub/sub)
- State Manager (write-through cache)
- Agent Coordinator (priority queue)
- Error Handler (core + extensions)

**Week 2: CLI Commands**
- `ao spawn` — Agent spawning
- `ao assign` — Story assignment
- `ao status` — Status viewing
- `ao fleet` — Fleet monitoring
- `ao resume` — Blocked story resolution
- `ao health` — Health checks

### Phase 2 (Sprint 2): Dashboard - 2 weeks

**Week 3: Dashboard Components**
- Fleet monitoring matrix
- Agent session cards
- Real-time status updates (SSE)
- Story queue visualization

**Week 4: Advanced Features**
- Real-time burndown charts
- Drill-down logs
- In-app notifications
- Drag-and-drop assignment

### Phase 3 (Sprint 3): Advanced Features - 1 week

**Conflict Resolution (FR41-FR44)**
- Multi-agent conflict detection
- Automatic reassignment
- Conflict history UI

**Plugin Extensibility (FR45-FR50)**
- Custom workflow plugins
- Plugin API documentation
- Plugin registry

## Non-Functional Requirements Coverage

| NFR Category | Count | Architecture Support |
|--------------|-------|---------------------|
| **Performance** (9) | ✅ All | In-memory cache, Redis, async ops |
| **Security** (11) | ✅ All | execFile, API key protection, timeouts |
| **Scalability** (8) | ✅ All | Redis, queue-based, stateless services |
| **Integration** (9) | ✅ All | Plugin system, type definitions |
| **Reliability** (10) | ✅ All | Graceful degradation, watchdog, backups |

## Functional Requirements Coverage

| FR Category | Count | Architecture Support |
|-------------|-------|---------------------|
| **Sprint Planning** (FR1-FR8) | ✅ All | Agent Coordinator, CLI commands |
| **State Sync** (FR9-FR16) | ✅ All | State Manager, file watcher |
| **Event Bus** (FR17-FR24) | ✅ All | Event Bus, Notification Service |
| **Dashboard** (FR25-FR32) | ⚠️ Phase 2 | Real-time updates, fleet monitoring |
| **Error Handling** (FR33-FR40) | ✅ All | Error Handler, Circuit Breaker |
| **Conflict Resolution** (FR41-FR44) | ⚠️ Phase 2 | Coordinator, Phase 2 enhancements |
| **Plugin Extensibility** (FR45-FR50) | ⚠️ Phase 3 | Plugin system, Phase 3 work |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Redis dependency** | Event bus unavailable | Fallback to in-memory, queue locally |
| **BMAD tracker downtime** | Can't sync state | Graceful degradation, queue updates |
| **Agent timeout** | Story blocks indefinitely | Watchdog restart, reassign story |
| **Data corruption** | State inconsistency | Backup restore, validation |
| **Performance degradation** | 10+ agents slow | Priority queue, async ops, monitoring |

## Next Steps

1. ✅ **Create Architecture Document** (This document)
2. **Create Epics and Stories** — Break down 50 FRs into implementable stories
3. **Create UX Design Document** — Dashboard wireframes, interaction patterns
4. **Begin Sprint Planning** — Plan Sprint 1 (CLI MVP)
5. **Start Implementation** — Follow story order from sprint plan

---

**Document Status**: ✅ Complete

**Date**: 2026-03-05

**Architect**: System Architect (BMAD Architecture Workflow)

**Project**: agent-orchestrator — BMAD Workflow Orchestration Integration

---

## Workflow Dashboard Feature Architecture

**PRD**: `prd-workflow-dashboard.md` (31 FRs, 27 NFRs)
**Date**: 2026-03-13
**Scope**: Read-only visibility tab — zero coupling to broader architecture decisions above

This section defines architectural decisions for the BMAD Workflow Dashboard feature. This feature is **independent** of the Event Bus, State Manager, Agent Coordinator, and Redis infrastructure defined in the broader architecture. It is a standalone read-only visibility layer that reads BMAD files from disk and renders them in the existing Next.js dashboard.

### Relationship to Broader Architecture

| Broader Architecture Component | Workflow Dashboard Dependency |
|---|---|
| Event Bus (Redis Pub/Sub) | **None** — uses chokidar file watching, not event bus |
| State Manager | **None** — reads files directly, no shared state |
| Agent Coordinator | **None** — displays agent manifest, not live agent status |
| Plugin System | **None** — not a plugin, lives in `packages/web` |
| SSE Infrastructure | **Minimal** — adds one event type to existing stream |
| Navigation | **Minimal** — adds one entry to `navItems[]` |

---

### Decision WD-1: Phase Computation Engine

**Problem**: The dashboard must compute phase states (not-started, done, active) for 4 BMAD phases from artifact presence on disk. The algorithm must handle 81 possible permutations (3^4) deterministically. If not specified precisely, implementing agents will write different inference logic.

**Selected**: Downstream Inference with Latest-Active-Phase Algorithm

**Algorithm** (`compute-state.ts`):

```typescript
const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;
type Phase = (typeof PHASES)[number];
type PhaseState = "not-started" | "done" | "active";

function computePhaseStates(artifactsByPhase: Record<Phase, boolean>): Array<{ id: Phase; state: PhaseState }> {
  // Step 1: Find the latest phase that has artifacts
  let lastActiveIndex = -1;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (artifactsByPhase[PHASES[i]]) {
      lastActiveIndex = i;
      break;
    }
  }

  // Step 2: No artifacts at all → all not-started
  if (lastActiveIndex === -1) {
    return PHASES.map((id) => ({ id, state: "not-started" as PhaseState }));
  }

  // Step 3: Apply downstream inference
  return PHASES.map((id, index) => {
    if (index < lastActiveIndex) return { id, state: "done" as PhaseState };     // Downstream inference
    if (index === lastActiveIndex) return { id, state: "active" as PhaseState };  // Current phase
    return { id, state: "not-started" as PhaseState };                            // Future phases
  });
}
```

**Key behavioral rules**:

1. **Downstream inference**: If Solutioning has artifacts but Planning does not, Planning is still "done" — the existence of later-phase artifacts implies earlier phases were completed (possibly outside the tool)
2. **Latest-active wins**: Only ONE phase can be "active" at a time — the latest phase with artifacts
3. **Implementation never "done"**: Since there's no phase after Implementation, it can only be "active" or "not-started" via artifact detection. "Done" for Implementation would require a signal outside the file system (e.g., all stories shipped), which is out of scope for MVP
4. **No artifacts = all not-started**: The `EmptyWorkflowState` component handles this case at the UI layer
5. **Gaps are valid**: Analysis ○ | Planning ○ | Solutioning ★ | Implementation ○ is a valid state — it means someone created solutioning artifacts without going through the standard BMAD flow. Downstream inference still applies (Analysis and Planning shown as "done")

**Test strategy**: Enumerate all 81 permutations of `{true, false}^4` (4 phases × present/absent). For each, assert the expected phase states. This is TS-08.

**Edge case table** (selected from the 81):

| Analysis | Planning | Solutioning | Implementation | Result |
|---|---|---|---|---|
| false | false | false | false | ○ ○ ○ ○ |
| true | false | false | false | ★ ○ ○ ○ |
| true | true | false | false | ● ★ ○ ○ |
| true | true | true | false | ● ● ★ ○ |
| true | true | true | true | ● ● ● ★ |
| false | false | true | false | ● ● ★ ○ (downstream inference) |
| false | true | false | false | ● ★ ○ ○ (downstream inference) |
| false | false | false | true | ● ● ● ★ (downstream inference) |
| true | false | true | false | ● ● ★ ○ (gap in Planning — still inferred done) |

---

### Decision WD-2: Artifact-to-Phase Mapping

**Problem**: Files in `_bmad-output/` must be classified by BMAD phase. The mapping must be a single constant, updatable without logic changes (NFR-M2).

**Selected**: Ordered pattern-matching rules with directory fallback

```typescript
type ArtifactRule = {
  pattern: string;      // glob pattern matched against filename (case-insensitive)
  phase: Phase;
  type: string;         // human-readable type for UI display
};

const ARTIFACT_RULES: ArtifactRule[] = [
  // Analysis phase
  { pattern: "*brief*",           phase: "analysis",      type: "Product Brief" },
  { pattern: "*research*",        phase: "analysis",      type: "Research Report" },
  { pattern: "project-context*",  phase: "analysis",      type: "Project Context" },

  // Planning phase
  { pattern: "*prd*",             phase: "planning",      type: "PRD" },
  { pattern: "*ux-design*",       phase: "planning",      type: "UX Design" },
  { pattern: "*ux-spec*",         phase: "planning",      type: "UX Specification" },

  // Solutioning phase
  { pattern: "*architecture*",    phase: "solutioning",   type: "Architecture" },
  { pattern: "*epic*",            phase: "solutioning",   type: "Epics & Stories" },

  // Implementation phase
  { pattern: "*sprint*",          phase: "implementation", type: "Sprint Plan" },
];
```

**Classification algorithm**:

1. Scan `{project_root}/_bmad-output/planning-artifacts/` for `*.md` files (non-recursive, skip directories like `research/` — scan those separately)
2. Scan `{project_root}/_bmad-output/planning-artifacts/research/` for `*.md` files (if directory exists)
3. Scan `{project_root}/_bmad-output/implementation-artifacts/` for `*.md` files
4. For each file, match filename against `ARTIFACT_RULES` in order — first match wins
5. Files in `implementation-artifacts/` that don't match any rule default to `{ phase: "implementation", type: "Story Spec" }`
6. Files in `planning-artifacts/` that don't match any rule go to `{ phase: null, type: "Uncategorized" }` — visible in inventory but not counted toward phase completion (FR11)
7. `.backup` files and non-`.md` files are ignored

**Why ordered matching**: Rules are checked sequentially. A file named `prd-architecture-comparison.md` matches `*prd*` first → classified as Planning, not Solutioning. Rule order encodes priority.

**Updating the mapping**: To support new BMAD artifact types, add a row to `ARTIFACT_RULES`. No logic changes needed. This satisfies NFR-M2.

---

### Decision WD-3: Recommendation Engine

**Problem**: The AI Guide must produce deterministic, context-voice recommendations based on artifact state. Rules must be precisely specified — different implementations of "missing artifact detection" would produce different recommendations.

**Selected**: Ordered rule chain with first-match-wins semantics

```typescript
type Recommendation = {
  tier: 1 | 2;
  observation: string;   // Factual statement about current state
  implication: string;    // What this means for next steps (no imperatives)
  phase: string;          // Which phase this recommendation relates to
};

type RecommendationRule = {
  tier: 1 | 2;
  condition: (ctx: RuleContext) => boolean;
  observation: (ctx: RuleContext) => string;
  implication: (ctx: RuleContext) => string;
  phase: Phase;
};

type RuleContext = {
  phases: Array<{ id: Phase; state: PhaseState }>;
  artifactsByPhase: Record<Phase, string[]>;  // filenames per phase
  hasAnyArtifacts: boolean;
};
```

**Rule chain** (evaluated in order, first match returns):

| # | Tier | Condition | Observation | Implication | Phase |
|---|---|---|---|---|---|
| R1 | 1 | No artifacts at all | "No BMAD artifacts found" | "Analysis phase not yet started — product brief is the typical first artifact" | analysis |
| R2 | 1 | Analysis active, no brief | "No product brief found" | "Product brief is the foundational analysis artifact" | analysis |
| R3 | 1 | Planning active, no PRD | "{analysis artifacts} present. PRD not found" | "PRD translates analysis into actionable requirements" | planning |
| R4 | 2 | Solutioning active, no architecture | "PRD present. Architecture spec not found" | "Architecture decisions needed before implementation breakdown" | solutioning |
| R5 | 2 | Solutioning active, architecture present, no epics | "Architecture spec present. No epic or story files found" | "Work breakdown into epics and stories enables sprint planning" | solutioning |
| R6 | 2 | Implementation active | "All solutioning artifacts present. Implementation phase active" | "Implementation is underway" | implementation |
| R7 | — | All phases have artifacts | `null` (no recommendation) | — | — |

**Context voice rules** (enforced in all observation/implication strings):
- No imperative verbs ("Create...", "Run...", "Start...")
- Pattern: "[State observation]. [Implication/next artifact]."
- Factual tone — observations, not instructions
- Example of what NOT to write: "You should create an architecture document"

**Null recommendation**: When R7 matches (all phases have artifacts), the API returns `recommendation: null`. The AIGuide component renders nothing or a completion message. This is not an error state.

**Flex behavior (Scope Ladder)**: At the 5-day tier, only rules R1-R3 (Tier 1) ship. Rules R4-R6 (Tier 2) are deferred. The engine returns `null` for any state that would trigger Tier 2 rules.

---

### Decision WD-4: API Design & Contract

**Selected**: Single endpoint, always-200, nullable fields

**Endpoint**: `GET /api/workflow/[project]`

**Response interface** (frozen after PR 1 merges):

```typescript
interface WorkflowResponse {
  projectId: string;
  projectName: string;
  phases: Array<{
    id: string;       // "analysis" | "planning" | "solutioning" | "implementation"
    label: string;    // "Analysis" | "Planning" | "Solutioning" | "Implementation"
    state: "not-started" | "done" | "active";
  }>;
  agents: Array<{
    name: string;         // CSV "name" column
    displayName: string;  // CSV "displayName" column
    title: string;        // CSV "title" column
    icon: string;         // CSV "icon" column (emoji)
    role: string;         // CSV "role" column
  }> | null;              // null if agent-manifest.csv not found or unreadable
  recommendation: {
    tier: 1 | 2;
    observation: string;
    implication: string;
    phase: string;
  } | null;               // null when no actionable recommendation (R7)
  artifacts: Array<{
    filename: string;     // e.g. "prd-workflow-dashboard.md"
    phase: string;        // e.g. "planning"
    type: string;         // e.g. "PRD" (from ARTIFACT_RULES)
    path: string;         // relative path from project root
    modifiedAt: string;   // ISO 8601 timestamp
  }>;
  lastActivity: {
    filename: string;
    phase: string;
    modifiedAt: string;   // ISO 8601
  } | null;               // null if no artifacts found
}
```

**Error handling rules**:

| Scenario | HTTP Status | Response |
|---|---|---|
| Project not found in config | 404 | `{ error: "Project not found" }` |
| No `_bmad/` directory | 200 | Valid response with empty arrays, null fields, all phases "not-started" |
| Malformed files | 200 | LKG state (see WD-7), or best-effort with null fields |
| File permission denied | 200 | Skip unreadable files, return what's readable |
| Any unexpected error | 500 | `{ error: "message" }` |

**Contract freeze protocol** (from PRD operational constraints):
- After PR 1 merges, `WorkflowResponse` is frozen
- Any PR modifying the interface requires a comment explaining why the freeze is broken
- API computes ALL fields regardless of which UI components are deployed

---

### Decision WD-5: SSE Integration

**Problem**: Dashboard must update within 500ms of BMAD file changes (TS-05). The existing SSE handler polls SessionManager every 5s. Workflow needs file-change-driven events on the same channel (TS-10: "new event type on existing channel, not a new route").

**Selected**: Chokidar file watcher with module-level singleton, injected into existing SSE stream

**Architecture**:

```
chokidar.watch() ──200ms debounce──► workflowWatcher singleton
                                          │
                                          ├──► SSE stream 1 (client A)
                                          ├──► SSE stream 2 (client B)
                                          └──► SSE stream N
```

**Implementation pattern**:

```typescript
// Module-level singleton — shared across all SSE connections
// File: packages/web/src/lib/workflow-watcher.ts

import chokidar from "chokidar";  // Already a dependency (used by Next.js dev server)

type WatcherCallback = (projectId: string) => void;

let watcher: chokidar.FSWatcher | null = null;
const listeners = new Set<WatcherCallback>();

export function subscribeWorkflowChanges(callback: WatcherCallback): () => void {
  // Lazy initialization on first subscriber
  if (!watcher) {
    initWatcher();
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function initWatcher() {
  // Watch BMAD output directories for all configured projects
  // Paths resolved from agent-orchestrator.yaml at init time
  watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },  // 200ms debounce (TS-05)
    ignored: [/node_modules/, /\.git/],
  });

  watcher.on("all", (_event, _path) => {
    const projectId = resolveProjectFromPath(_path);
    if (projectId) {
      for (const cb of listeners) cb(projectId);
    }
  });
}
```

**SSE handler modification** (`/api/events/route.ts`):

```typescript
// ADD to existing stream setup — alongside session polling
const unsubscribe = subscribeWorkflowChanges((projectId) => {
  try {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: "workflow-change", projectId })}\n\n`)
    );
  } catch {
    // Stream closed
  }
});

// ADD to cancel() cleanup
cancel() {
  clearInterval(heartbeat);
  clearInterval(updates);
  unsubscribe();  // Clean up file watcher subscription
}
```

**Client-side handling**: The Workflow page listens for `workflow-change` events and refetches `GET /api/workflow/[project]`. This is a notification pattern — the SSE event carries only `projectId`, the client fetches fresh data from the API.

**Chokidar as existing dependency**: chokidar is already in the dependency tree via Next.js dev server. This is NOT a new dependency (TS-01 satisfied). Verify with `pnpm why chokidar` before implementation.

**Latency budget** (TS-05: <500ms end-to-end):

| Stage | Budget | Mechanism |
|---|---|---|
| File write → chokidar detection | ~50ms | OS file system events |
| Debounce stabilization | 200ms | `awaitWriteFinish.stabilityThreshold` |
| SSE dispatch | <50ms | In-memory callback (NFR-P4) |
| Network + client processing | ~100ms | localhost, minimal payload |
| **Total** | **~400ms** | **Within 500ms budget** |

---

### Decision WD-6: Component Architecture

**Selected**: Independent panel components with props-only data flow

**Component tree**:

```
WorkflowPage (route: /workflow)
├── ProjectSelector (dropdown — reuses existing pattern from HomeView)
├── EmptyWorkflowState (if no _bmad/ directory)
└── WorkflowDashboard (if BMAD configured)
    ├── PhaseBar          ← phases[]
    ├── AIGuide           ← recommendation | null
    ├── AgentsPanel       ← agents[] | null
    ├── ArtifactInventory ← artifacts[]
    └── LastActivity      ← lastActivity | null
```

**Data flow**: WorkflowPage fetches from `/api/workflow/[project]`, receives `WorkflowResponse`, passes slices to each panel as props. No shared context, no global state, no cross-panel communication.

**Layout** (CSS Grid, 1280x800 minimum — US-05):

```
┌─────────────────────────────────────────────────┐
│ PhaseBar (full width, compact)                  │
├──────────────────────────┬──────────────────────┤
│ AIGuide (2/3 width)      │ LastActivity (1/3)   │
├──────────────────────────┼──────────────────────┤
│ ArtifactInventory (2/3)  │ AgentsPanel (1/3)    │
└──────────────────────────┴──────────────────────┘
```

**Isolation rules** (NFR-M1, NFR-M4, TS-11):

1. Each panel is a single `.tsx` file in `packages/web/src/components/`
2. Each panel accepts typed props derived from `WorkflowResponse` — no internal fetching
3. Each panel renderable in isolation with mock data (unit testable)
4. Zero imports from Sprint Board components, tracker-bmad, or `@composio/ao-core`
5. Zero shared state between panels — if AIGuide needs phase info, it receives it as props
6. Workflow components prefixed: `WorkflowPhaseBar.tsx`, `WorkflowAIGuide.tsx`, etc.

**EmptyWorkflowState**: Rendered when API returns all phases as "not-started" AND no artifacts. Non-judgmental invitation copy explaining what BMAD is. No error styling — this is an expected state (Journey 2, FR22).

---

### Decision WD-7: LKG (Last-Known-Good) State Pattern

**Problem**: The dashboard must show useful information even when BMAD files are malformed, mid-write, or inaccessible (TS-07: 30 scenarios across 6 file states x 5 panels).

**Selected**: Three-layer LKG with silent degradation

**Layer 1 — File Reading** (`compute-state.ts`):

| File State | Behavior |
|---|---|
| Normal | Parse and return data |
| Empty file | Classify by filename pattern only (no frontmatter). Counts as artifact present |
| Partial content | Classify by filename pattern. Extract what's parseable |
| Malformed YAML | Skip frontmatter parsing, classify by filename pattern only |
| Mid-write (locked) | `awaitWriteFinish` debounce handles this. If still unreadable after debounce, skip silently |
| Permission denied | Skip file, log warning to console. Do not include in response |

**Layer 2 — API Response** (`/api/workflow/[project]/route.ts`):

```typescript
// In-memory cache per project (module-level Map)
const lkgCache = new Map<string, WorkflowResponse>();

// On successful computation:
lkgCache.set(projectId, response);
return NextResponse.json(response);

// On computation error:
const cached = lkgCache.get(projectId);
if (cached) return NextResponse.json(cached);  // Stale but valid
return NextResponse.json(emptyResponse(projectId));  // Graceful empty
```

**Layer 3 — Client** (`WorkflowPage`):

- SSE `workflow-change` event triggers refetch
- If refetch fails (network error), retain previous data in React state
- No error toasts, no error banners — stale data is silently acceptable
- Loading states only on initial page load, not on SSE-triggered refetches

**Design rationale**: Wrong-but-directionally-correct is better than error states. A malformed architecture file classified by filename as "Solutioning artifact present" is technically imprecise but functionally useful — the user knows solutioning has started (Journey 4).

---

### Decision WD-8: File System Scanning & BMAD Detection

**Directories scanned**:

| Directory | Purpose | Required? |
|---|---|---|
| `{root}/_bmad/` | BMAD presence detection | Yes — absence triggers EmptyWorkflowState |
| `{root}/_bmad/_config/agent-manifest.csv` | Agent list | No — `agents: null` if absent |
| `{root}/_bmad-output/planning-artifacts/` | Analysis, Planning, Solutioning artifacts | No — empty arrays if absent |
| `{root}/_bmad-output/planning-artifacts/research/` | Research subdirectory | No — merged into planning-artifacts scan |
| `{root}/_bmad-output/implementation-artifacts/` | Implementation artifacts (story specs) | No — empty array if absent |

**Project root resolution**: Read from `agent-orchestrator.yaml` project config. Each project entry implies a root directory. For the web dashboard's own project (common case), use CWD.

**Scan implementation**:

```typescript
import { readdir, stat, readFile } from "node:fs/promises";

async function scanArtifacts(dir: string): Promise<ScannedFile[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: ScannedFile[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith(".backup")) {
        const filePath = path.join(dir, entry.name);
        const fileStat = await stat(filePath);
        files.push({
          filename: entry.name,
          path: path.relative(projectRoot, filePath),
          modifiedAt: fileStat.mtime.toISOString(),
        });
      }
      // Recurse into research/ subdirectory only
      if (entry.isDirectory() && entry.name === "research") {
        const subFiles = await scanArtifacts(path.join(dir, entry.name));
        files.push(...subFiles);
      }
    }
    return files;
  } catch {
    return [];  // Directory doesn't exist or unreadable — not an error
  }
}
```

**Agent manifest parsing**: Parse CSV with simple line-splitting (no CSV library needed — the format is straightforward). If parsing fails, return `agents: null`.

---

### New File Structure

All new files created by this feature:

```
packages/web/src/
├── app/
│   ├── workflow/
│   │   └── page.tsx                          # Server-rendered Workflow page
│   └── api/
│       └── workflow/
│           └── [project]/
│               └── route.ts                  # GET /api/workflow/[project]
├── components/
│   ├── WorkflowDashboard.tsx                 # Layout container for 5 panels
│   ├── WorkflowPhaseBar.tsx                  # Phase progress indicator
│   ├── WorkflowAIGuide.tsx                   # Recommendation display
│   ├── WorkflowAgentsPanel.tsx               # BMAD agent list
│   ├── WorkflowArtifactInventory.tsx         # Artifact table
│   ├── WorkflowLastActivity.tsx              # Most recent activity
│   └── EmptyWorkflowState.tsx                # No-BMAD invitation
├── hooks/
│   └── useWorkflowSSE.ts                     # SSE listener for workflow-change events
└── lib/
    ├── workflow/
    │   ├── compute-state.ts                  # Phase computation (WD-1)
    │   ├── artifact-rules.ts                 # ARTIFACT_RULES constant (WD-2)
    │   ├── recommendation-engine.ts          # Rule chain (WD-3)
    │   ├── scan-artifacts.ts                 # File system scanning (WD-8)
    │   ├── parse-agents.ts                   # CSV parsing for agent manifest
    │   └── types.ts                          # WorkflowResponse + internal types
    └── workflow-watcher.ts                   # Chokidar singleton (WD-5)
```

**Files modified** (3 brownfield touchpoints):

| File | Change |
|---|---|
| `components/Navigation.tsx` | Add `{ href: "/workflow", label: "Workflow" }` to `navItems` |
| `app/api/events/route.ts` | Subscribe to `workflowWatcher`, emit `workflow-change` events |
| `lib/types.ts` | Add `WorkflowChangeEvent` to SSE event type union |

---

### Data Flow Diagram

```
                    ┌──────────────────────────────────┐
                    │        File System                │
                    │  _bmad-output/planning-artifacts/ │
                    │  _bmad-output/impl-artifacts/     │
                    │  _bmad/_config/agent-manifest.csv │
                    └────────┬────────────┬────────────┘
                             │            │
                    ┌────────▼────┐  ┌────▼──────────┐
                    │ chokidar    │  │ scanArtifacts  │
                    │ (watcher)   │  │ parseAgents    │
                    └────────┬────┘  └────┬───────────┘
                             │            │
                    ┌────────▼────┐  ┌────▼───────────┐
                    │ 200ms       │  │ computePhases  │
                    │ debounce    │  │ getRecommend.  │
                    └────────┬────┘  └────┬───────────┘
                             │            │
                    ┌────────▼────┐  ┌────▼───────────┐
                    │ SSE event   │  │ WorkflowResp.  │
                    │ workflow-   │  │ (JSON)         │
                    │ change      │  └────┬───────────┘
                    └────────┬────┘       │
                             │            │
        ┌────────────────────▼────────────▼────────────┐
        │              WorkflowPage (client)            │
        │                                               │
        │  Initial fetch ──► setState(WorkflowResponse) │
        │  SSE event ──► refetch ──► setState(updated)  │
        │                                               │
        │  ┌─────────┐ ┌────────┐ ┌──────────────────┐ │
        │  │PhaseBar │ │AIGuide │ │ArtifactInventory │ │
        │  └─────────┘ └────────┘ └──────────────────┘ │
        │  ┌──────────────┐ ┌────────────────────────┐ │
        │  │ AgentsPanel  │ │    LastActivity         │ │
        │  └──────────────┘ └────────────────────────┘ │
        └──────────────────────────────────────────────┘
```

---

### PR Decomposition (Implementation Order)

| PR | Contents | Dependencies | Estimated Weight |
|---|---|---|---|
| **PR 1** | `compute-state.ts`, `artifact-rules.ts`, `recommendation-engine.ts`, `scan-artifacts.ts`, `parse-agents.ts`, `types.ts`, API route, exhaustive tests (81 permutations + 30 error scenarios) | None | Heavy (~30% of sprint) |
| **PR 2** | `WorkflowPage`, `EmptyWorkflowState`, `WorkflowPhaseBar`, Navigation change, page route | PR 1 | Medium |
| **PR 3** | `WorkflowAIGuide`, `WorkflowAgentsPanel` | PR 2 | Light |
| **PR 4** | `WorkflowArtifactInventory`, `WorkflowLastActivity` | PR 2 | Light |
| **PR 5** | `workflow-watcher.ts`, `useWorkflowSSE.ts`, SSE handler modification, SSE type addition | PR 2 | Medium |

PRs 3, 4, 5 are order-independent after PR 2 merges.

---

### Traceability to PRD

| Architecture Decision | PRD Requirements Satisfied |
|---|---|
| WD-1: Phase Computation | FR1, FR2, FR3, FR4, TS-08 (81 permutations) |
| WD-2: Artifact Mapping | FR10, FR11, NFR-M2 |
| WD-3: Recommendation Engine | FR5, FR6, FR7, FR8, TS-08, NFR-T1 |
| WD-4: API Design | FR31, TS-03, TS-10, NFR-R2, NFR-M3 |
| WD-5: SSE Integration | FR16, FR17, FR18, TS-05, NFR-P3, NFR-P4, NFR-R3, NFR-R5 |
| WD-6: Component Architecture | FR19-FR23, TS-02, TS-11, NFR-M1, NFR-M4 |
| WD-7: LKG State Pattern | FR24-FR27, TS-07, NFR-R1, NFR-R4 |
| WD-8: File Scanning | FR9, FR10, FR14, FR15, FR23, FR28-FR30 |

---

### Project Structure & Boundaries

#### Complete File Tree (with annotations)

```
packages/web/src/
├── app/
│   ├── workflow/
│   │   └── page.tsx                          # Server component: initial data fetch, project resolution
│   └── api/
│       └── workflow/
│           └── [project]/
│               └── route.ts                  # GET handler: orchestrates scan → compute → respond
├── components/
│   ├── WorkflowDashboard.tsx                 # CSS Grid layout, passes WorkflowResponse slices to panels
│   ├── WorkflowPhaseBar.tsx                  # <nav><ol> with phase indicators (○ ● ★)
│   ├── WorkflowAIGuide.tsx                   # Renders recommendation or null state
│   ├── WorkflowAgentsPanel.tsx               # Agent cards from manifest CSV
│   ├── WorkflowArtifactInventory.tsx         # Artifact table with phase, type, timestamp
│   ├── WorkflowLastActivity.tsx              # Single line: filename + relative time
│   └── EmptyWorkflowState.tsx                # Non-judgmental BMAD invitation
├── hooks/
│   └── useWorkflowSSE.ts                     # Filters SSE stream for workflow-change events
└── lib/
    ├── workflow/
    │   ├── compute-state.ts                  # computePhaseStates() — 81-permutation algorithm
    │   ├── artifact-rules.ts                 # ARTIFACT_RULES constant — single source of truth
    │   ├── recommendation-engine.ts          # getRecommendation() — 7-rule chain
    │   ├── scan-artifacts.ts                 # scanArtifacts() — readdir + stat + classify
    │   ├── parse-agents.ts                   # parseAgentManifest() — CSV line splitting
    │   └── types.ts                          # WorkflowResponse, PhaseState, ArtifactRule, etc.
    └── workflow-watcher.ts                   # chokidar singleton + subscriber registry
```

#### Test Organization

```
packages/web/src/lib/workflow/__tests__/
├── compute-state.test.ts                     # 81 permutations (TS-08)
├── recommendation-engine.test.ts             # All 7 rules + null case (NFR-T1: >80%)
├── scan-artifacts.test.ts                    # 6 file states × read scenarios (TS-07)
├── artifact-rules.test.ts                    # Classification edge cases
├── parse-agents.test.ts                      # CSV parsing + malformed input
└── fixtures/
    ├── sample-bmad-output/                   # Realistic BMAD directory for integration tests
    │   ├── planning-artifacts/
    │   │   ├── product-brief-test.md
    │   │   ├── prd-test.md
    │   │   └── architecture-test.md
    │   └── implementation-artifacts/
    │       └── 1-1-test-story.md
    └── agent-manifest-sample.csv             # Test CSV fixture

packages/web/src/components/__tests__/
├── WorkflowPhaseBar.test.tsx                 # All 3 states rendered correctly
├── WorkflowAIGuide.test.tsx                  # Recommendation + null + context voice
├── WorkflowAgentsPanel.test.tsx              # Agent list + null (no manifest)
├── WorkflowArtifactInventory.test.tsx        # Table rendering + empty state
├── WorkflowLastActivity.test.tsx             # Relative timestamp + null
└── EmptyWorkflowState.test.tsx               # Invitation copy + no error styling
```

Test fixture note (NFR-T4): The **actual** `_bmad/` directory from this repository serves as a real-world integration test fixture alongside the synthetic fixtures above.

#### Integration Boundaries

**Import boundary rules** (NFR-M4):

| From | Can Import | Cannot Import |
|---|---|---|
| `lib/workflow/*` | `node:fs`, `node:path`, own sibling modules | Any `@composio/ao-core`, any Sprint Board code, any tracker-bmad |
| `components/Workflow*` | React, Tailwind utilities, `lib/workflow/types.ts` | Other `Workflow*` components (no cross-panel imports), Sprint Board components, `@composio/ao-core` |
| `hooks/useWorkflowSSE` | `useSSEConnection` (existing hook) | Direct file system access, API route internals |
| `app/api/workflow/*/route.ts` | `lib/workflow/*`, `lib/services.ts` (for config) | Component code, hook code, Sprint Board API routes |

**Data boundary**: The only data exchange between Workflow Dashboard and the existing system is:

1. **Config reading**: API route reads project list from `agent-orchestrator.yaml` via existing `getServices()` — same pattern as Sprint Board
2. **SSE channel**: Workflow watcher injects events into the existing SSE stream — no shared data, just event notification
3. **Navigation**: Single entry in `navItems[]` — no shared state

#### FR-to-File Mapping

| FR Category | FRs | Primary Files |
|---|---|---|
| Lifecycle Visibility | FR1-FR4 | `compute-state.ts`, `WorkflowPhaseBar.tsx` |
| AI-Guided Recommendations | FR5-FR8 | `recommendation-engine.ts`, `WorkflowAIGuide.tsx` |
| Artifact Management | FR9-FR12 | `scan-artifacts.ts`, `artifact-rules.ts`, `WorkflowArtifactInventory.tsx`, `WorkflowLastActivity.tsx` |
| Agent Discovery | FR13-FR15 | `parse-agents.ts`, `WorkflowAgentsPanel.tsx` |
| Real-Time Updates | FR16-FR18 | `workflow-watcher.ts`, `useWorkflowSSE.ts`, SSE handler mod |
| Navigation & Page | FR19-FR23 | `page.tsx`, `WorkflowDashboard.tsx`, `EmptyWorkflowState.tsx`, Navigation mod |
| Error Resilience | FR24-FR27 | `compute-state.ts` (LKG), `route.ts` (cache), all components (null handling) |
| Data Integrity | FR28-FR31 | `route.ts` (read-only enforcement), `types.ts` (response shape) |

#### Development Workflow

**Build dependency**: Workflow Dashboard code lives entirely in `packages/web` — no cross-package build dependencies. Unlike Sprint Board (which imports `@composio/ao-core`), all Workflow logic is self-contained in `lib/workflow/`.

**Dev server**: `pnpm dev` in `packages/web` — works immediately. No need to rebuild core packages when modifying Workflow Dashboard code.

**Test command**: `pnpm vitest --reporter=verbose packages/web/src/lib/workflow` for unit tests, `pnpm vitest packages/web/src/components/__tests__/Workflow*` for component tests.

---

### Workflow Dashboard Validation Results

#### Coherence Validation ✅

| Check | Status | Detail |
|---|---|---|
| WD-1 ↔ WD-2 | ✅ | compute-state consumes artifact-rules output. Clean pipeline |
| WD-3 ↔ WD-1 | ✅ | Recommendation engine receives phase states. No circular dependency |
| WD-4 ↔ WD-7 | ✅ | API always-200 aligns with LKG cache fallback |
| WD-5 ↔ WD-6 | ✅ | SSE sends notification only, client refetches full data |
| WD-6 panel isolation | ✅ | All panels receive props from WorkflowResponse slices |
| WD-8 ↔ WD-2 | ✅ | Scanning produces file list, artifact rules classify. Single-direction |
| Pattern consistency | ✅ | Naming follows existing conventions (kebab files, PascalCase components) |
| Technology alignment | ✅ | Next.js 15, React, Tailwind, vitest — all existing stack |

No contradictions found across all 8 decisions.

#### Requirements Coverage ✅

All 31 FRs and 27 NFRs have architectural support:

| Category | FRs | Decisions |
|---|---|---|
| Lifecycle Visibility | FR1-FR4 | WD-1, WD-6 |
| AI Recommendations | FR5-FR8 | WD-3, WD-6 |
| Artifact Management | FR9-FR12 | WD-2, WD-8, WD-6 |
| Agent Discovery | FR13-FR15 | parse-agents, WD-6 |
| Real-Time Updates | FR16-FR18 | WD-5 |
| Navigation & Page | FR19-FR23 | WD-6 |
| Error Resilience | FR24-FR27 | WD-7 |
| Data Integrity | FR28-FR31 | WD-4 |

NFR coverage: Performance (WD-4, WD-5), Reliability (WD-7), Accessibility (WD-6 component specs), Maintainability (WD-2, WD-4, WD-6), Testability (test organization).

#### Gap Analysis

**Gap WD-G1 (Important): File watcher dependency**

WD-5 specifies chokidar for file watching. Chokidar may only be available as a transitive dev dependency via Next.js, not in production. Adding it explicitly would violate TS-01 (zero new dependencies).

**Resolution**: Prefer `node:fs.watch()` (Node 20+ native) with manual 200ms debounce (~15 lines). Zero dependency risk. Sufficient for localhost dev dashboard. The architecture decision WD-5 is updated to treat chokidar as the secondary option, `node:fs.watch()` as primary.

**Gap WD-G2 (Important): CSV parsing for quoted fields**

Agent manifest CSV contains quoted fields with embedded commas. Simple `split(",")` breaks.

**Resolution**: Implement a minimal quoted-CSV parser (~20 lines). No external dependency. Only 5 columns needed (`name`, `displayName`, `title`, `icon`, `role`). Parser validates in `parse-agents.test.ts`.

#### Implementation Readiness ✅

| Criterion | Status |
|---|---|
| Algorithms specified with pseudocode | ✅ (computePhaseStates, recommendation rules) |
| Data structures fully typed | ✅ (WorkflowResponse interface) |
| Import boundaries documented | ✅ (boundary table) |
| Test strategy with file tree | ✅ (test org + fixtures) |
| PR decomposition with ordering | ✅ (5 PRs, dependency chain) |
| Edge cases enumerated | ✅ (81 permutations, 30 error scenarios, 9-row example table) |

#### Architecture Completeness Checklist

- [x] Requirements analyzed (31 FRs, 27 NFRs mapped)
- [x] 8 architectural decisions documented with rationale
- [x] Technology stack: zero new dependencies, existing stack only
- [x] Algorithm pseudocode for phase computation and recommendation engine
- [x] API contract defined and freeze protocol specified
- [x] Component architecture with isolation rules
- [x] Error resilience (LKG) pattern at 3 layers
- [x] File structure with every new file listed
- [x] Integration boundaries with import rules
- [x] Test organization with fixture strategy
- [x] PR decomposition with dependency ordering
- [x] PRD traceability matrix (all FRs → decisions)
- [x] Gap analysis with mitigations

**Overall Status**: READY FOR IMPLEMENTATION

**Confidence**: HIGH — well-constrained scope, zero new infrastructure, existing patterns, exhaustive test strategy

---

