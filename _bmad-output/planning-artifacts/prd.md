---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - docs/design/design-brief.md
  - docs/design/orchestrator-terminal-designbrief.md
  - docs/design/design-session-detail-design-brief.md
  - _bmad-output/project-context.md
workflowType: prd
classification:
  projectType: Developer Tool / Infrastructure
  domain: Developer Tools / DevOps
  complexity: HIGH
  projectContext: brownfield
---

# Product Requirements Document - agent-orchestrator

**Author:** R2d2
**Date:** 2026-03-05
**Cycle 3 Addendum:** [prd-cycle-3-ai-intelligence.md](./prd-cycle-3-ai-intelligence.md) — AI Agent Intelligence & Tech Debt (38 new requirements)

---

## Document Metadata

**Workflow Status:** Step 12 of 12 (Initialized)
**Project:** agent-orchestrator
**Type:** Complete PRD for BMAD Workflow Orchestration Integration

---

## Executive Summary

**Agent Orchestrator × BMAD: Closed-Loop Development Automation**

### Vision Alignment

Development teams face a coordination bottleneck: PMs define plans in BMAD, developers execute in Agent Orchestrator, but the two systems don't talk. State changes in one don't propagate to the other. Teams manually reconcile sprint status, story assignments, and progress tracking. This friction breaks flow, introduces errors, and defeats the purpose of automation.

**Our vision**: Unified workflow where BMAD planning intelligence triggers Agent Orchestrator execution, and agent actions automatically update BMAD state—no manual reconciliation, zero friction, full bidirectional sync with ≤5-second latency.

### What Makes This Special

| Aspect | Current State | After Integration |
|--------|---------------|-------------------|
| **Planning → Execution** | Manual handoff, copy-paste stories | BMAD sprint plan → auto-spawn agents with story context |
| **Execution → Planning** | Manual status updates, stale dashboards | Agent completes story → auto-update sprint-status.yaml |
| **Agent Coordination** | Manual assignment, conflicts inevitable | Intelligent routing: 5+ concurrent agents with conflict resolution |
| **State Sync** | Brittle, requires human intervention | Event bus pattern: changes propagate in ≤5 seconds |
| **Human in Loop** | Interrupt-driven (ask for status) | Push-based (notify when judgment needed) |

**Key Differentiator**: Not just one-way triggers—**true bidirectional orchestration**. BMAD doesn't just spawn agents; agents report back. Sprint health metrics adapt to real-time agent behavior. Dependency chains auto-update when stories complete. PMs see live sprint burndown as agents code.

### Market Need Validation

- **Dev teams** want to code, not sync tools
- **PMs** want accurate sprint health, not manual status checks
- **Tech leads** want visibility into agent activity without babysitting
- **Current gap**: Tools exist in silos; integration requires brittle scripts

**Total addressable pain**: Any team using AI coding agents + structured project management (growing rapidly as AI agents proliferate).

### Project Classification

| Dimension | Classification |
|-----------|----------------|
| **Project Type** | Developer Tool / Infrastructure |
| **Domain** | Developer Tools / DevOps |
| **Complexity** | HIGH (multi-agent coordination, event bus architecture, state sync, conflict resolution) |
| **Context** | Brownfield (extending existing Agent Orchestrator with BMAD integration) |

---

## Success Criteria

### User Success

**The "Aha!" Moment:**
- **PMs** run `ao sprint plan` → see agents auto-spawn → check dashboard 30 minutes later → 3 stories completed, sprint status updated
- **Developers** finish coding a story → close PR → sprint burndown updates automatically within 5 seconds
- **Tech leads** open dashboard → see real-time agent activity → zero manual status checks required

**Emotional Success States:**
- **Relief**: "I haven't manually synced sprint status in 2 weeks"
- **Delight**: "Agents just picked up the next story automatically"
- **Empowerment**: "I planned the sprint, agents handled execution, I only got notified for the blocked story"

**Completion Scenarios:**
- Sprint complete → all stories marked done → retrospective auto-generated → zero manual data entry
- Dependency completes → dependent stories auto-unblock → agents pick up next work → no human orchestration

### Business Success

**3-Month Success Indicators:**
| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Adoption** | 70% of dev teams using BMAD + Agent Orchestrator together | Proves integrated workflow is preferred |
| **Efficiency** | 4+ hours saved per sprint on manual status sync | Quantifiable time savings for PMs |
| **Automation Rate** | 60% of sprint stories completed through auto-routing | Demonstrates intelligent agent coordination |
| **Sprint Health** | Cycle time reduced by 25%, velocity increased by 15% | Shows integration improves development outcomes |

**12-Month Success Indicators:**
- **Retention**: 80% of teams continue using integrated workflow after 6 months
- **Expansion**: 3+ new tracker/agent integrations enabled by architecture
- **Community**: Open-source contributors building custom workflow plugins

### Technical Success

**Performance SLAs:**
| Metric | Target | Rationale |
|--------|--------|-----------|
| **State Sync Latency** | ≤5 seconds (p95) | Dashboard feels "live", prevents agent conflicts |
| **Agent Spawn Time** | ≤10 seconds from sprint plan → agent running | PMs perceive instant gratification |
| **Event Throughput** | 100+ events/second without backlog | Supports 10+ concurrent agents at scale |
| **Uptime** | 99.5% for workflow orchestration service | Non-blocking for dev workflows |

**Data Integrity:**
- Zero lost state updates (eventual consistency with deduplication)
- Automatic conflict detection and resolution for concurrent modifications
- Audit trail for all state transitions (JSONL event log)

**Integration Quality:**
- Plugin architecture enables new tracker/agent combos without core changes
- Event bus pattern supports 5+ concurrent subscribers
- Graceful degradation if BMAD or Agent Orchestrator unavailable

### Measurable Outcomes

**Quantitative:**
- 4+ hours saved per sprint (manual status sync eliminated)
- 60% of stories auto-routed to appropriate agents
- ≤5-second state sync latency (p95)
- 70% user adoption within 3 months

**Qualitative:**
- "Zero manual reconciliation" — users never copy-paste between systems
- "Push, not pull" — users notified only when judgment needed
- "Mission control" — dashboard density matches Grafana/LangSmith
- "One-click actions" — friction-free workflow execution

---


## User Journeys

### Journey 1: Sarah the PM — Sprint Planning with Agents

**Opening Scene:**
Sarah is a product manager at a Series B startup. Her team just finished Sprint 12, and she's staring at the BMAD sprint retrospective. Velocity is down 15% because developers spent 4+ hours manually updating story status across GitHub Issues and the sprint board. She's tired, it's 5 PM on Friday, and Sprint 13 planning starts Monday.

**Rising Action:**
Sarah runs `ao sprint plan --spawn-agents`. The CLI responds:
```
✓ Sprint 13 plan created
✓ 8 stories prioritized
→ Spawning 3 agents with story context...
```

She opens the web dashboard. Dense, high-contrast cards show agent sessions spinning up. Sarah sees "Agent-1" picking up the authentication refactor story. The sprint burndown chart is live — a line tracing downward in real-time as agents complete tasks.

30 minutes later, she refreshes. 3 stories are already marked "completed". The sprint-status.yaml file has been updated automatically. Sarah's email inbox has zero notifications — nothing required her judgment.

**Climax:**
Monday morning standup. The team lead asks, "What's our sprint status?" Sarah opens the dashboard. The burndown shows 3/8 stories done. "Agents handled the backlog items," she says. "Let's focus on the edge cases."

The team is shocked. No manual status sync. No "who's working on what?" confusion. The sprint board reflects reality.

**Resolution:**
Sprint 13 finishes 2 days early. The retrospective shows cycle time reduced by 40%. Sarah hasn't manually synced a story status in 3 weeks. She spends her time on product strategy, not project administration.

**Emotional Arc:** Overwhelmed → Hopeful → Delighted → Empowered

---

### Journey 2: Alex the Developer — Blocked Story Recovery

**Opening Scene:**
Alex is a senior engineer. He's working on a story that depends on the API refactoring agent's work. He checks the dashboard — the dependency story is marked "in-progress" but hasn't moved in 45 minutes. The agent must be stuck.

His blood pressure rises. If this doesn't unblock, he's dead in the water. He's seen automation fail before — hours of debugging, broken workflows, manual workarounds.

**Rising Action:**
Alex clicks the agent session card. A modal shows:
```
Agent-3 (API refactor)
Status: BLOCKED
Last action: 45m ago
Issue: Test suite failure — 3 tests failing
```

The dashboard presents a clear decision: "Agent needs human judgment. Review and resolve?" Alex clicks **Review**.

The terminal pane slides in. He sees the failing test output. It's a type mismatch — the agent didn't update a mock. Alex fixes it in 2 minutes, clicks **Resume Agent**.

**Climax:**
The agent resumes. Within 5 minutes, the story completes. The dependency chain auto-unblocks. Alex's own story assignment lights up — "Ready to start."

Alex realizes the system didn't just fail and stop. It recognized its limitation, asked for help, and let him do what humans do best: triage.

**Resolution:**
Alex finishes his story by 3 PM. He logs off feeling like the automation amplified his capabilities, not replaced them. The system handled 80% of the work and asked for help on the 20% that required judgment.

**Emotional Arc:** Anxious → Frustrated → Relieved → Satisfied

---

### Journey 3: Jordan the Tech Lead — Monitoring Agent Fleet

**Opening Scene:**
Jordan runs platform engineering. His team is running 15 concurrent agents across 3 active sprints. He's responsible for making sure the orchestration doesn't collapse into chaos.

Previous automation attempts failed spectacularly — race conditions, conflicting story assignments, lost state updates. Jordan is skeptical.

**Rising Action:**
He opens the dashboard in "Fleet View" mode. A matrix shows all 15 agents with status indicators:
```
Agent-1  [●] coding — Story #423 (12m active)
Agent-2  [●] coding — Story #424 (8m active)
Agent-3  [!] blocked — Story #425 (needs human)
...
Agent-15 [●] idle — awaiting assignment
```

Jordan notices something: two agents are picking at the same story. Conflict detection has kicked in. The dashboard shows:
```
⚠️ Conflict detected: Agents 7 and 9 both assigned Story #431
→ Resolution: Agent-9 priority higher, Agent-7 reassigned to #432
```

The system handled it. No data race. No manual intervention.

**Climax:**
Jordan checks the event log. Every state transition is recorded:
```
2026-03-05T14:23:11Z story-created #431
2026-03-05T14:23:15Z agent-assigned agent-7 → #431
2026-03-05T14:24:02Z agent-assigned agent-9 → #431
2026-03-05T14:24:05Z conflict-detected duplicate-assignment
2026-03-05T14:24:06Z conflict-resolved agent-7 → #432
```

Zero lost events. Complete audit trail. Jordan realizes this isn't brittle automation — it's production-grade orchestration.

**Resolution:**
Jordan promotes the integration to the entire engineering org. Three months later, 70% of teams use it. Cycle time is down 25%. He hasn't received a single "automation broke my sprint" complaint.

**Emotional Arc:** Skeptical → Vigilant → Impressed → Confident

---

### Journey 4: Sam the DevOps Engineer — Troubleshooting Sync Failure

**Opening Scene:**
Sam is on-call. The monitoring dashboard alerts: "Workflow orchestration service health: DEGRADED." State sync latency spiked to 45 seconds (threshold: ≤5s).

He's seen this before. Some process is wedged, the event bus is backing up, and soon agents will start stepping on each other.

**Rising Action:**
Sam checks the health endpoint:
```bash
$ ao workflow health
→ Event bus: BACKLOGGED (1,247 events pending)
→ Agent spawn rate: 0.2/sec (normal: 1-5/sec)
→ BMAD tracker: CONNECTED
→ State sync: LAGGING
```

The event bus consumer thread is stuck. Sam checks logs — a malformed event from a BMAD plugin bug caused the consumer to panic. The watchdog didn't restart it.

Sam restarts the workflow service:
```bash
systemctl restart ao-workflow
```

**Climax:**
The service restarts. The event bus drains the backlog within 30 seconds. State sync latency returns to 2 seconds. Agents resume normal operations.

Sam realizes: graceful degradation worked. The system didn't crash — it slowed down, logged everything, and recovered cleanly when he restarted the service. No state was lost.

**Resolution:**
Sam files a bug on the BMAD plugin. Next day, the fix is deployed. He adds an alert rule for event bus backlog >100 events. The system runs smoothly for the next 6 months.

**Emotional Arc:** Alerted → Focused → Relieved → Prepared

---

### Journey 5: Taylor the Open Source Contributor — Building a Custom Workflow

**Opening Scene:**
Taylor is a developer who uses Agent Orchestrator for personal projects. She wants to add a custom workflow: "When a story is tagged `security`, auto-assign to a security-specialized agent and run static analysis."

She's contributed to OSS before, but proprietary automation tools are usually walled gardens. She expects this will be impossible.

**Rising Action:**
Taylor reads the plugin documentation:
```yaml
# Custom workflow plugins
name: security-workflow
on:
  story-created:
    tags: ['security']
trigger:
  - agent: security-specialist
  - action: run-static-analysis
```

She creates a simple plugin in 50 lines of TypeScript. Drops it in `~/.ao/plugins/`. Restarts the workflow service.

**Climax:**
Taylor creates a test story tagged `security`. The dashboard shows:
```
✓ Security workflow triggered
→ Agent 'security-specialist' assigned
→ Static analysis: 0 vulnerabilities
```

It worked. The plugin system is extensible. She can build custom automation without touching core code.

**Resolution:**
Taylor submits her workflow plugin as a PR to the Agent Orchestrator repo. It gets merged. Other contributors build workflow plugins for code review, documentation generation, dependency updates. The ecosystem grows.

**Emotional Arc:** Curious → Hopeful → Surprised → Empowered

---

### Journey Requirements Summary

| Journey | Key Capabilities Required |
|---------|---------------------------|
| **Sarah (PM)** | CLI sprint planning with auto-spawn, live dashboard burndown, automatic state updates, zero-friction notifications |
| **Alex (Dev)** | Blocked story detection, human judgment handoff, resume capability, dependency auto-unblocking |
| **Jordan (Tech Lead)** | Fleet monitoring view, conflict detection/resolution, event audit trail, production-grade reliability |
| **Sam (DevOps)** | Health monitoring, graceful degradation, event bus recovery, comprehensive logging |
| **Taylor (Contributor)** | Plugin extensibility, custom workflow definitions, open documentation, community contribution path |

**Cross-Cutting Capabilities:**
- Real-time state synchronization (≤5s latency)
- Event bus architecture for pub/sub
- Conflict detection and resolution
- Human-in-the-loop decision points
- Comprehensive audit logging
- Graceful failure handling

---

## Developer Tool Specific Requirements

### Project-Type Overview

**Agent Orchestrator × BMAD Integration** is a developer tool that combines:
- **CLI interface** (`ao` commands)
- **Plugin architecture** (8 swappable slots)
- **Web dashboard** (Next.js)
- **Event bus service** (real-time orchestration)

The integration enables bidirectional sync between BMAD planning workflows and Agent Orchestrator execution, targeting professional development teams using AI coding agents.

---

### Technical Architecture Considerations

**Core Technology Stack:**
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js ≥20.0.0 | Required for ESM, TypeScript, plugin system |
| **Language** | TypeScript 5.7.0 | Type safety, plugin interfaces |
| **Package Manager** | pnpm 9.15.4 | Workspace monorepo, efficient installs |
| **Web Framework** | Next.js 15.1.0 (App Router) | Modern React, server components |
| **CLI** | Commander.js | Standard CLI framework |
| **Config** | YAML + Zod | Human-readable, validated |
| **Testing** | Vitest 4.0.18, Playwright | Unit + E2E tests |

**Architecture Pattern:**
```
┌─────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Runtime │  │  Agent   │  │Workspace │  │Tracker │  │
│  │  Plugin  │  │  Plugin  │  │  Plugin  │  │ Plugin │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │             │             │            │         │
│       └─────────────┴─────────────┴────────────┘         │
│                      │                                   │
│              ┌───────▼────────┐                          │
│              │  Event Bus     │                          │
│              │  (Core Service)│                          │
│              └───────┬────────┘                          │
└──────────────────────┼──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼─────┐                  ┌────▼────┐
   │   BMAD   │                  │   Web   │
   │  Plugin  │                  │Dashboard│
   └──────────┘                  └─────────┘
```

---

### Language Support Matrix

| Language | Status | Notes |
|----------|--------|-------|
| **TypeScript** | ✅ Primary | All packages use TypeScript 5.7.0 |
| **JavaScript (ESM)** | ✅ Supported | Compiled output, `.js` extensions required |
| **Python** | ❌ Not planned | No current Python integration |
| **Go** | ❌ Not planned | No current Go integration |

**ESM Requirements (Critical):**
```typescript
// ✅ Correct - .js extension in imports
import { foo } from "./bar.js";

// ❌ Incorrect - will fail at runtime
import { foo } from "./bar";

// ✅ Correct - node: prefix for builtins
import { readFileSync } from "node:fs";
```

---

### Installation & Setup Methods

**Prerequisites:**
- Node.js ≥20.0.0
- pnpm 9.15.4 (or compatible)
- Git (for worktree support)

**Installation Methods:**

| Method | Command | Use Case |
|--------|---------|----------|
| **Global npm** | `npm install -g @composio/ao-cli` | Global CLI access |
| **Global pnpm** | `pnpm install -g @composio/ao-cli` | Preferred method |
| **Docker** | `docker run composio/agent-orchestrator` | Containerized deployment |
| **From source** | `git clone && pnpm install && pnpm build` | Development/contribution |

**Post-Install Setup:**
```bash
# 1. Create config
cp agent-orchestrator.yaml.example agent-orchestrator.yaml

# 2. Configure BMAD tracker
# (edit agent-orchestrator.yaml)

# 3. Initialize workspace
ao init

# 4. Start dashboard
cd packages/web && pnpm dev
```

---

### API Surface

**Plugin Interfaces (Core Types):**

All plugins implement typed interfaces from `@composio/ao-core`:

```typescript
// Runtime Plugin (tmux, process, docker)
interface Runtime {
  name: string;
  create(config: RuntimeConfig): Promise<RuntimeHandle>;
  destroy(handle: RuntimeHandle): Promise<void>;
  exec(handle: RuntimeHandle, command: string): Promise<ExecResult>;
}

// Agent Plugin (claude-code, codex, aider)
interface Agent {
  name: string;
  create(config: AgentConfig): Promise<AgentHandle>;
  destroy(handle: AgentHandle): Promise<void>;
  send(handle: AgentHandle, message: string): Promise<void>;
  subscribe(handle: AgentHandle, callback: MessageCallback): void;
}

// Workspace Plugin (worktree, clone)
interface Workspace {
  name: string;
  create(config: WorkspaceConfig): Promise<WorkspaceHandle>;
  destroy(handle: WorkspaceHandle): Promise<void>;
  getPath(handle: WorkspaceHandle): string;
}

// Tracker Plugin (github, linear, bmad)
interface Tracker {
  name: string;
  listIssues(filter: IssueFilter): Promise<Issue[]>;
  updateIssue(id: string, updates: IssueUpdates): Promise<void>;
  createIssue(issue: IssueCreate): Promise<string>;
  getStory(id: string): Promise<Story>;
}

// Event Bus (Core Service)
interface EventBus {
  publish(event: Event): void;
  subscribe(eventType: string, handler: EventHandler): Unsubscribe;
  start(): void;
  stop(): void;
}
```

**Event Types:**
| Event | Payload | Published By |
|-------|---------|--------------|
| `story-created` | `{ storyId, projectId, sprintId }` | BMAD plugin |
| `story-started` | `{ storyId, agentId, timestamp }` | Agent plugin |
| `story-completed` | `{ storyId, agentId, timestamp }` | Agent plugin |
| `story-blocked` | `{ storyId, reason, timestamp }` | Agent plugin |
| `conflict-detected` | `{ agents, storyId, conflictType }` | Event bus |

---

### Code Examples & Usage Patterns

**Example 1: Sprint Planning with Auto-Spawn**
```bash
# Create sprint plan and spawn agents automatically
ao sprint plan --project myapp --spawn-agents

# Output:
# ✓ Sprint plan created
# ✓ 8 stories prioritized
# → Spawning 3 agents with story context...
#   - Agent-1: Authentication refactor
#   - Agent-2: API updates
#   - Agent-3: Test coverage
```

**Example 2: Monitor Agent Activity**
```bash
# Check workflow health
ao workflow health

# Output:
# → Event bus: HEALTHY
# → Active agents: 3
# → State sync latency: 2.3s (p95)
# → BMAD tracker: CONNECTED
```

**Example 3: Custom Workflow Plugin**
```typescript
// ~/.ao/plugins/security-workflow.ts
import type { WorkflowPlugin, Event } from '@composio/ao-core';

export const manifest = {
  name: 'security-workflow',
  version: '1.0.0',
};

export function create(): WorkflowPlugin {
  return {
    name: 'security-workflow',
    async handle(event: Event) {
      if (event.type === 'story-created' && event.payload.tags?.includes('security')) {
        // Auto-assign to security-specialized agent
        return {
          action: 'assign-agent',
          agentId: 'security-specialist',
          runStaticAnalysis: true,
        };
      }
    },
  };
}

export default { manifest, create } satisfies PluginModule<WorkflowPlugin>;
```

---

### Migration & Upgrade Guide

**For Users of BMAD Standalone:**

| Scenario | Migration Path |
|----------|----------------|
| **BMAD CLI only** | Install Agent Orchestrator, configure BMAD tracker plugin |
| **Manual sync workflow** | Enable event bus, configure auto-spawn agents |
| **Custom BMAD plugins** | Verify compatibility with AO event bus interface |

**Version Upgrade Process:**
```bash
# Check current version
ao --version

# Upgrade to latest
pnpm update -g @composio/ao-cli

# Check for breaking changes
ao migrate --check

# Run migrations
ao migrate --apply
```

**Breaking Change Communication:**
- All changes documented in CHANGELOG.md
- Migration warnings in CLI
- Automated migration where possible
- Manual migration guide for complex changes

---

### Implementation Considerations

**Plugin Development Guidelines:**
- Always use `export default { manifest, create } satisfies PluginModule<T>`
- Throw typed errors, don't return error codes
- Validate external data (API/file inputs)
- Use `execFile` not `exec` for shell commands
- Add timeouts to all external operations

**Testing Requirements:**
- Unit tests: `*.test.ts` co-located with source
- Integration tests: `__tests__/` for cross-package tests
- E2E tests: Playwright for critical workflows
- Minimum coverage: 80% unit, 70% integration

**Performance Targets:**
| Metric | Target | Measured By |
|--------|--------|-------------|
| State sync latency | ≤5s (p95) | Event bus timestamps |
| Agent spawn time | ≤10s | CLI spawn command |
| CLI response | <500ms | Command execution |
| Dashboard load | <2s | Page load metrics |

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — Prove bidirectional orchestration works reliably

**Rationale:** 
- Users must trust the system with their sprint data
- One-way triggers exist; bidirectional sync is the differentiator
- Technical complexity (HIGH) requires focus on core reliability over breadth

**Resource Requirements:** 2-3 developers, 1 PM/UX, 8 weeks

**Success Definition:** PM runs `ao sprint plan --spawn-agents` → agents code → sprint-status.yaml updates automatically within ≤5s — zero manual intervention required

---

### MVP Feature Set (Phase 1: Weeks 1-4)

**Core User Journeys Supported:**
- ✅ Sarah (PM): Sprint planning with auto-spawn
- ✅ Alex (Dev): Blocked story recovery
- ⚠️ Jordan (Tech Lead): Basic fleet monitoring (no conflict resolution yet)

**Must-Have Capabilities:**

| Category | Feature | Why MVP |
|----------|---------|---------|
| **Triggers** | BMAD → Agent spawn | Core value prop |
| **State Sync** | Agent → BMAD updates | Core value prop |
| **Event Bus** | Pub/sub for 3 event types | Infrastructure foundation |
| **Dashboard** | Live burndown + agent activity | User visibility |
| **CLI** | `ao sprint plan --spawn-agents` | Primary interface |
| **Error Handling** | Graceful degradation | Reliability requirement |

**Explicitly Excluded from MVP:**
- ❌ Conflict resolution (manual detection + notification only)
- ❌ Intelligent agent routing (round-robin assignment)
- ❌ Multi-tracker support (BMAD-only)
- ❌ Custom workflow plugins
- ❌ Advanced notifications (desktop notifications only)

**MVP Success Criteria:**
- PM completes sprint planning with agents spawned
- Agent completion updates sprint status in ≤5s
- Dashboard shows live burndown
- Zero state loss in event bus (audit trail complete)

---

### Post-MVP Features

**Phase 2: Growth (Weeks 5-6)**
*Competitive differentiation*

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| **Conflict Resolution** | Detect + resolve concurrent agent modifications | MVP event bus |
| **Intelligent Routing** | Assign stories based on agent capabilities | MVP agent tracking |
| **Dependency Handling** | Auto-unblock dependent stories | MVP state sync |
| **Enhanced Notifications** | Slack, webhook alerts | MVP notification system |

**Phase 3: Expansion (Weeks 7-8+ + Future)**
*Platform vision*

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| **Multi-Tracker Support** | Jira, Linear, GitHub Projects | Phase 2 event bus |
| **Custom Workflow Plugins** | User-defined triggers/automation | Phase 2 routing |
| **Predictive Planning** | AI suggests story assignments | Phase 2 routing + history |
| **Fully Autonomous Sprints** | Plan → Execute → Retro with zero touch | All prior phases |

---

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Event bus reliability** | Medium | High | Comprehensive logging, graceful degradation, watchdog restart |
| **State sync conflicts** | High | Medium | MVP: manual notification; Phase 2: auto-resolution |
| **Agent spawn failures** | Low | Medium | Clear error messages, retry logic, fallback to manual assignment |
| **BMAD plugin compatibility** | Medium | High | Tight integration with BMAD team, version pinning |

**Market Risks:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Users don't trust automation** | Medium | High | Transparent audit trail, manual override always available |
| **One-way triggers deemed "good enough"** | Low | High | Emphasize zero-reconciliation benefit in onboarding |
| **Competing solutions emerge** | Medium | Medium | Focus on plugin extensibility and ecosystem |

**Resource Risks:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **8-week timeline insufficient** | Medium | High | MVP scope tightly defined; Phase 2/3 can slip |
| **Developer expertise gap** | Low | Medium | TypeScript/Node.js common skills; clear project-context.md rules |
| **DevOps bandwidth for monitoring** | Medium | Low | Self-service health checks; minimal operational overhead |

**Contingency Plan:**
- If timeline slips: Drop conflict resolution from Phase 2
- If resources constrained: Drop multi-tracker support from Phase 3
- If technical blockers discovered: Fall back to one-way triggers (BMAD → AO only)

---

## Functional Requirements

### Sprint Planning & Agent Orchestration

- **FR1**: Product Managers can create sprint plans that automatically spawn agents with story context
- **FR2**: The system can assign stories to agents based on availability and priority
- **FR3**: Product Managers can trigger agent spawning via CLI command with project and sprint parameters
- **FR4**: The system can pass story context (title, description, acceptance criteria) to spawned agents
- **FR5**: Developers can view which agent is working on which story through the dashboard
- **FR6**: The system can detect when an agent has completed a story assignment
- **FR7**: Developers can manually assign stories to specific agents when needed
- **FR8**: The system can resume agent execution after human intervention for blocked stories

### State Synchronization

- **FR9**: The system can automatically update sprint-status.yaml when agents complete story work
- **FR10**: The system can propagate state changes from Agent Orchestrator to BMAD tracker within 5 seconds
- **FR11**: The system can propagate state changes from BMAD tracker to Agent Orchestrator within 5 seconds
- **FR12**: The system can detect when sprint burndown needs recalculation based on story completions
- **FR13**: The system can unblock dependent stories when their prerequisite stories are completed
- **FR14**: The system can maintain an audit trail of all state transitions in JSONL event log
- **FR15**: Developers can view current sprint status without manual refresh
- **FR16**: The system can reconcile conflicting state updates without data loss

### Event Bus & Notifications

- **FR17**: The system can publish events when stories are created, started, completed, or blocked
- **FR18**: The system can subscribe to specific event types for targeted processing
- **FR19**: The system can route events to multiple subscribers concurrently
- **FR20**: Developers can receive notifications when agent work requires human judgment
- **FR21**: The system can detect event bus backlog and trigger alerts
- **FR22**: Developers can configure notification preferences (desktop, slack, webhook)
- **FR23**: The system can deduplicate duplicate events to prevent redundant processing
- **FR24**: The system can persist events to durable storage for recovery

### Dashboard & Monitoring

- **FR25**: Product Managers can view live sprint burndown charts updated in real-time
- **FR26**: Tech Leads can view a fleet monitoring matrix showing all active agents
- **FR27**: Developers can view agent session cards with status indicators (coding, blocked, idle)
- **FR28**: The system can display agent activity history with timestamps
- **FR29**: DevOps Engineers can view workflow health metrics (event bus status, sync latency, agent count)
- **FR30**: Developers can drill into agent sessions to view detailed logs and error messages
- **FR31**: The system can display conflict detection alerts when multiple agents target the same story
- **FR32**: Tech Leads can view event audit trails for troubleshooting

### Error Handling & Recovery

- **FR33**: The system can detect when an agent is blocked (no activity for specified threshold)
- **FR34**: The system can gracefully degrade when event bus or tracker services are unavailable
- **FR35**: Developers can review and resolve blocked agent issues through a terminal interface
- **FR36**: The system can recover event bus backlog after service restart
- **FR37**: The system can log all errors with sufficient context for troubleshooting
- **FR38**: The system can retry failed operations with exponential backoff
- **FR39**: DevOps Engineers can configure health check thresholds and alert rules
- **FR40**: The system can detect data corruption in metadata files and recover from backups

### Conflict Resolution & Coordination (Phase 2)

- **FR41**: The system can detect when multiple agents are assigned to the same story
- **FR42**: The system can resolve conflicts by reassigning lower-priority agents to available stories
- **FR43**: The system can prevent new agent assignments when conflicts are detected
- **FR44**: Tech Leads can view conflict resolution history and decisions

### Plugin & Workflow Extensibility (Phase 3)

- **FR45**: Developers can install custom workflow plugins to extend orchestration behavior
- **FR46**: Developers can define custom trigger conditions based on story tags, labels, or attributes
- **FR47**: The system can load and validate plugins at startup
- **FR48**: Plugin developers can define custom event handlers for workflow automation
- **FR49**: The system can provide plugin API documentation and type definitions
- **FR50**: Developers can contribute plugins to a community plugin registry

---

## Non-Functional Requirements

### Performance

**State Synchronization:**
- **NFR-P1**: State changes propagate between BMAD and Agent Orchestrator within 5 seconds (p95)
- **NFR-P2**: Sprint burndown charts update within 2 seconds of story completion events
- **NFR-P3**: Dashboard pages load within 2 seconds on standard WiFi connection

**Agent Operations:**
- **NFR-P4**: Agent spawn time from CLI command to agent-ready state is ≤10 seconds
- **NFR-P5**: Agent status changes (blocked, completed, idle) reflect in dashboard within 3 seconds

**Event Bus:**
- **NFR-P6**: Event bus processes 100+ events/second without backlog accumulation
- **NFR-P7**: Event latency from publish to subscriber delivery is ≤500ms (p95)

**CLI Responsiveness:**
- **NFR-P8**: CLI commands return within 500ms for non-spawning operations
- **NFR-P9**: CLI help text displays within 200ms

---

### Security

**API Key & Credential Management:**
- **NFR-S1**: API keys stored in configuration files are readable only by file owner (permissions 600)
- **NFR-S2**: API keys never appear in logs or error messages
- **NFR-S3**: Sensitive configuration values are encrypted at rest when supported by plugin

**Access Control:**
- **NFR-S4**: Dashboard requires authentication for access (when hosted)
- **NFR-S5**: CLI operations respect file system permissions for project configuration
- **NFR-S6**: Plugin execution sandboxed from core process when technically feasible

**Code Execution:**
- **NFR-S7**: All external command execution uses `execFile` (not `exec`) to prevent shell injection
- **NFR-S8**: User-provided input is never interpolated into shell commands or scripts
- **NFR-S9**: External commands include timeout limits (30s default) to prevent hanging

**Data Protection:**
- **NFR-S10**: Sprint data, story content, and agent logs contain no PII by design
- **NFR-S11**: Event logs are retained locally and not transmitted externally without user consent

---

### Scalability

**Concurrent Agent Support:**
- **NFR-SC1**: System supports 10+ concurrent agents without performance degradation >10%
- **NFR-SC2**: Event bus scales linearly with agent count (no single-threaded bottlenecks)

**Project Scale:**
- **NFR-SC3**: System supports 100+ stories per sprint without dashboard performance degradation
- **NFR-SC4**: System supports 10+ concurrent projects on single instance

**Event Throughput:**
- **NFR-SC5**: Event bus handles burst events (1000 events in 10 seconds) without data loss
- **NFR-SC6**: Event backlog drains within 30 seconds after service restart

**Growth Headroom:**
- **NFR-SC7**: Architecture supports horizontal scaling for event bus consumers (Phase 3)
- **NFR-SC8**: Plugin system supports unlimited custom workflow plugins without core changes

---

### Integration

**Plugin Architecture:**
- **NFR-I1**: Plugins load and validate within 2 seconds at startup
- **NFR-I2**: Plugin failures do not crash core process (isolation boundaries)
- **NFR-I3**: Plugin API provides TypeScript type definitions for compile-time validation

**BMAD Tracker Integration:**
- **NFR-I4**: BMAD plugin compatible with sprint-status.yaml format version 1.0+
- **NFR-I5**: BMAD plugin handles malformed YAML gracefully (error + recovery, not crash)

**Git Host Integration:**
- **NFR-I6**: System works with GitHub, GitLab, and Bitbucket via unified SCM plugin interface
- **NFR-I7**: Git operations respect user-configured credentials and SSH keys

**Runtime Integration:**
- **NFR-I8**: System supports tmux, process, and Docker runtimes via unified Runtime plugin interface
- **NFR-I9**: Runtime failures trigger graceful degradation, not system crash

---

### Reliability

**Uptime & Availability:**
- **NFR-R1**: Workflow orchestration service maintains 99.5% uptime (excludes planned maintenance)
- **NFR-R2**: CLI functions remain available when web dashboard is unavailable

**Error Handling:**
- **NFR-R3**: System gracefully degrades when BMAD tracker is unavailable (queue events, sync when restored)
- **NFR-R4**: System gracefully degrades when event bus is unavailable (log events, recover on restart)
- **NFR-R5**: System never loses state updates (audit trail guarantees eventual consistency)

**Data Integrity:**
- **NFR-R6**: Zero data loss in event bus (durable persistence before acknowledgment)
- **NFR-R7**: Conflicting state updates resolve with user notification (no silent overwrites)
- **NFR-R8**: JSONL event log is append-only and immutable (audit trail integrity)

**Recovery:**
- **NFR-R9**: Event bus automatically recovers backlog after service restart
- **NFR-R10**: System detects and recovers from corrupted metadata files using backup/restore

---

