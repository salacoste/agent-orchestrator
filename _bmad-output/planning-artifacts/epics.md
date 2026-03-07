---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories"]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Agent Orchestrator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for agent-orchestrator, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Sprint Planning & Agent Orchestration (FR1-FR8):**
FR1: Product Managers can create sprint plans that automatically spawn agents with story context
FR2: The system can assign stories to agents based on availability and priority
FR3: Product Managers can trigger agent spawning via CLI command with project and sprint parameters
FR4: The system can pass story context (title, description, acceptance criteria) to spawned agents
FR5: Developers can view which agent is working on which story through the dashboard
FR6: The system can detect when an agent has completed a story assignment
FR7: Developers can manually assign stories to specific agents when needed
FR8: The system can resume agent execution after human intervention for blocked stories

**State Synchronization (FR9-FR16):**
FR9: The system can automatically update sprint-status.yaml when agents complete story work
FR10: The system can propagate state changes from Agent Orchestrator to BMAD tracker within 5 seconds
FR11: The system can propagate state changes from BMAD tracker to Agent Orchestrator within 5 seconds
FR12: The system can detect when sprint burndown needs recalculation based on story completions
FR13: The system can unblock dependent stories when their prerequisite stories are completed
FR14: The system can maintain an audit trail of all state transitions in JSONL event log
FR15: Developers can view current sprint status without manual refresh
FR16: The system can reconcile conflicting state updates without data loss

**Event Bus & Notifications (FR17-FR24):**
FR17: The system can publish events when stories are created, started, completed, or blocked
FR18: The system can subscribe to specific event types for targeted processing
FR19: Developers can receive notifications when agent work requires human judgment
FR20: Developers can configure notification preferences (desktop, slack, webhook)
FR21: The system can detect event bus backlog and trigger alerts
FR22: Developers can configure notification preferences (desktop, slack, webhook)
FR23: The system can deduplicate duplicate events to prevent redundant processing
FR24: The system can persist events to durable storage for recovery

**Dashboard & Monitoring (FR25-FR32):**
FR25: Product Managers can view live sprint burndown charts updated in real-time
FR26: Tech Leads can view a fleet monitoring matrix showing all active agents
FR27: Developers can view agent session cards with status indicators (coding, blocked, idle)
FR28: The system can display agent activity history with timestamps
FR29: DevOps Engineers can view workflow health metrics (event bus status, sync latency, agent count)
FR30: Developers can drill into agent sessions to view detailed logs and error messages
FR31: The system can display conflict detection alerts when multiple agents target the same story
FR32: Tech Leads can view event audit trails for troubleshooting

**Error Handling & Recovery (FR33-FR40):**
FR33: The system can detect when an agent is blocked (no activity for specified threshold)
FR34: The system can gracefully degrade when event bus or tracker services are unavailable
FR35: Developers can review and resolve blocked agent issues through a terminal interface
FR36: The system can recover event bus backlog after service restart
FR37: The system can log all errors with sufficient context for troubleshooting
FR38: The system can retry failed operations with exponential backoff
FR39: DevOps Engineers can configure health check thresholds and alert rules
FR40: The system can detect data corruption in metadata files and recover from backups

**Conflict Resolution & Coordination (FR41-FR44) - Phase 2:**
FR41: The system can detect when multiple agents are assigned to the same story
FR42: The system can resolve conflicts by reassigning lower-priority agents to available stories
FR43: The system can prevent new agent assignments when conflicts are detected
FR44: Tech Leads can view conflict resolution history and decisions

**Plugin & Workflow Extensibility (FR45-FR50) - Phase 3:**
FR45: Developers can install custom workflow plugins to extend orchestration behavior
FR46: Developers can define custom trigger conditions based on story tags, labels, or attributes
FR47: The system can load and validate plugins at startup
FR48: Plugin developers can define custom event handlers for workflow automation
FR49: The system can provide plugin API documentation and type definitions
FR50: Developers can contribute plugins to a community plugin registry

**Total FRs: 50**

### Non-Functional Requirements

**Performance (NFR-P1-P9):**
NFR-P1: State changes propagate between BMAD and Agent Orchestrator within 5 seconds (p95)
NFR-P2: Sprint burndown charts update within 2 seconds of story completion events
NFR-P3: Dashboard pages load within 2 seconds on standard WiFi connection
NFR-P4: Agent spawn time from CLI command to agent-ready state is ≤10 seconds
NFR-P5: Agent status changes (blocked, completed, idle) reflect in dashboard within 3 seconds
NFR-P6: Event bus processes 100+ events/second without backlog accumulation
NFR-P7: Event latency from publish to subscriber delivery is ≤500ms (p95)
NFR-P8: CLI commands return within 500ms for non-spawning operations
NFR-P9: CLI help text displays within 200ms

**Security (NFR-S1-S11):**
NFR-S1: API keys stored in configuration files are readable only by file owner (permissions 600)
NFR-S2: API keys never appear in logs or error messages
NFR-S3: Sensitive configuration values are encrypted at rest when supported by plugin
NFR-S4: Dashboard requires authentication for access (when hosted)
NFR-S5: CLI operations respect file system permissions for project configuration
NFR-S6: Plugin execution sandboxed from core process when technically feasible
NFR-S7: All external command execution uses `execFile` (not `exec`) to prevent shell injection
NFR-S8: User-provided input is never interpolated into shell commands or scripts
NFR-S9: External commands include timeout limits (30s default) to prevent hanging
NFR-S10: Sprint data, story content, and agent logs contain no PII by design
NFR-S11: Event logs are retained locally and not transmitted externally without user consent

**Scalability (NFR-SC1-SC8):**
NFR-SC1: System supports 10+ concurrent agents without performance degradation >10%
NFR-SC2: Event bus scales linearly with agent count (no single-threaded bottlenecks)
NFR-SC3: System supports 100+ stories per sprint without dashboard performance degradation
NFR-SC4: System supports 10+ concurrent projects on single instance
NFR-SC5: Event bus handles burst events (1000 events in 10 seconds) without data loss
NFR-SC6: Event backlog drains within 30 seconds after service restart
NFR-SC7: Architecture supports horizontal scaling for event bus consumers (Phase 3)
NFR-SC8: Plugin system supports unlimited custom workflow plugins without core changes

**Integration (NFR-I1-I9):**
NFR-I1: Plugins load and validate within 2 seconds at startup
NFR-I2: Plugin failures do not crash core process (isolation boundaries)
NFR-I3: Plugin API provides TypeScript type definitions for compile-time validation
NFR-I4: BMAD plugin compatible with sprint-status.yaml format version 1.0+
NFR-I5: BMAD plugin handles malformed YAML gracefully (error + recovery, not crash)
NFR-I6: System works with GitHub, GitLab, and Bitbucket via unified SCM plugin interface
NFR-I7: Git operations respect user-configured credentials and SSH keys
NFR-I8: System supports tmux, process, and Docker runtimes via unified Runtime plugin interface
NFR-I9: Runtime failures trigger graceful degradation, not system crash

**Reliability (NFR-R1-R10):**
NFR-R1: Workflow orchestration service maintains 99.5% uptime (excludes planned maintenance)
NFR-R2: CLI functions remain available when web dashboard is unavailable
NFR-R3: System gracefully degrades when BMAD tracker is unavailable (queue events, sync when restored)
NFR-R4: System gracefully degrades when event bus is unavailable (log events, recover on restart)
NFR-R5: System never loses state updates (audit trail guarantees eventual consistency)
NFR-R6: Zero data loss in event bus (durable persistence before acknowledgment)
NFR-R7: Conflicting state updates resolve with user notification (no silent overwrites)
NFR-R8: JSONL event log is append-only and immutable (audit trail integrity)
NFR-R9: Event bus automatically recovers backlog after service restart
NFR-R10: System detects and recovers from corrupted metadata files using backup/restore

**Total NFRs: 47**

### Additional Requirements

**From Architecture Document:**

**AR1: Event Bus Implementation**
- System must use Redis Pub/Sub for event distribution
- Event bus must support cross-process communication
- Events must include type, timestamp, and metadata
- Events must be persisted to Redis AOF for durability

**AR2: State Manager Implementation**
- System must implement write-through cache for state management
- YAML is the authoritative storage (sprint-status.yaml)
- In-memory cache provides sub-millisecond reads
- File watcher detects external YAML changes
- Optimistic locking with version stamps prevents conflicts

**AR3: Agent Coordinator Implementation**
- System must implement priority queue for story assignment
- Redis sorted set for queue (ZPOP for highest priority)
- Agent registry (Redis hash) tracks agent state
- Pre-assignment check prevents duplicate assignments
- Dependency resolution unblocks dependents when prerequisites complete

**AR4: Notification Service Implementation**
- Central service manages queue, deduplication, routing
- Plugin-based delivery (Desktop, Slack, Webhook)
- Push notifications for critical events (agent blocked, conflicts)
- Digest notifications for warnings (queue depth)

**AR5: Error Handler Implementation**
- Core handler + service-specific extensions
- Exponential backoff for transient failures (1s, 2s, 4s, 8s, 16s)
- Circuit breaker (5 failures → open 30s)
- Dead letter queue for failed operations after max retries

**AR6: CLI Commands (Phase 1 MVP)**
- `ao plan` — Generate sprint plan from YAML
- `ao spawn --story <id> [--agent <id>]` — Spawn agent with story context
- `ao assign <story-id> <agent-id>` — Manual story assignment
- `ao status [story-id]` — View story/agent/sprint status
- `ao fleet` — Fleet monitoring table
- `ao queue` — View story queue
- `ao health` — System health check
- `ao logs <agent-id> [--tail]` — View agent logs
- `ao resume <story-id>` — Resume blocked story
- `ao conflicts` — View conflict history
- `ao dlq` — View dead letter queue

**AR7: Dashboard Components (Phase 2)**
- Fleet monitoring matrix (3-column grid)
- Agent session cards with status indicators
- Real-time burndown charts
- Story queue visualization
- Notification center
- Conflict detection alerts
- Event audit trail viewer

**From UX Design Document:**

**UX1: CLI Visual Patterns**
- htop-style table formatting for `ao fleet`
- Color-coded status indicators (🟢🟡🔴 symbols)
- ASCII burndown charts for `ao burndown`
- Inline notification banners for critical alerts
- One-second comprehension goal for all outputs

**UX2: Dashboard Visual Patterns (Phase 2)**
- Progressive disclosure (summary → agent → story → logs)
- "Mission control" density for fleet monitoring
- Real-time SSE updates for live data
- Keyboard shortcuts for power users

**UX3: Design Tokens**
- Green (#22c55e) for success/working
- Yellow (#eab308) for warning/idle
- Red (#ef4444) for error/blocked
- Gray (#6b7280) for offline
- Shared tokens between CLI and dashboard

### FR Coverage Map

| Epic | FRs Covered |
|------|--------------|
| Epic 1: Sprint Planning & Agent Orchestration | FR1-FR8 |
| Epic 2: Event Bus & State Synchronization | FR9-FR16, AR1, AR2 |
| Epic 3: Dashboard & Monitoring | FR25-FR32, AR7 |
| Epic 4: Error Handling & Recovery | FR33-FR40, AR5 |
| Epic 5: Conflict Resolution & Coordination | FR41-FR44 (Phase 2) |
| Epic 6: Plugin & Workflow Extensibility | FR45-FR50 (Phase 3) |

### Epic List

| Epic | Description | Phase | Story Count |
|------|-------------|--------|-------------|
| **Epic 1: Sprint Planning & Agent Orchestration** | PMs create sprint plans that spawn agents with story context; agents assigned based on availability/priority; track agent-story assignments | Phase 1 | TBD |
| **Epic 2: Event Bus & State Synchronization** | Real-time state sync between Agent Orchestrator and BMAD tracker; event pub/sub; JSONL audit trail; automatic burndown recalculation | Phase 1 | TBD |
| **Epic 3: Dashboard & Real-Time Monitoring** | Live sprint burndown; fleet monitoring matrix; agent session cards; event audit trails; conflict detection alerts | Phase 2 | TBD |
| **Epic 4: Error Handling & Graceful Degradation** | Detect blocked agents; retry with exponential backoff; graceful degradation when services unavailable; dead letter queue | Phase 1 | TBD |
| **Epic 5: Multi-Agent Conflict Resolution** | Detect duplicate story assignments; resolve conflicts by reassignment; prevent new assignments during conflicts; view resolution history | Phase 2 | TBD |
| **Epic 6: Plugin & Workflow Extensibility** | Install custom workflow plugins; define trigger conditions; plugin API with type definitions; community plugin registry | Phase 3 | TBD |

---

## Epic 1: Sprint Planning & Agent Orchestration

**Epic Goal:** Product Managers can create sprint plans that automatically spawn agents with story context; agents assigned based on availability/priority; track agent-story assignments

**FRs Covered:** FR1-FR8
**Phase:** 1 (MVP - CLI-first)

---

### Story 1.1: CLI Generate Sprint Plan from YAML

As a Product Manager,
I want to generate a sprint execution plan from my sprint-status.yaml file,
So that I can see what stories are ready to be worked on and in what order.

**Acceptance Criteria:**

**Given** a valid sprint-status.yaml file exists in the project directory
**When** I run `ao plan`
**Then** the system parses the YAML and displays a sprint execution plan showing:
  - Total story count
  - Stories grouped by status (todo, in-progress, done)
  - Stories ordered by priority (if specified)
  - Dependency graph showing blocked stories and their prerequisites
**And** exits with code 0 if valid, code 1 if YAML is malformed
**And** completes within 500ms (NFR-P8)

**Given** the sprint-status.yaml contains stories with dependencies
**When** I run `ao plan`
**Then** the dependency graph shows which stories are blocked and which are ready
**And** displays a warning if circular dependencies are detected

**Given** no sprint-status.yaml file exists
**When** I run `ao plan`
**Then** displays error message: "No sprint-status.yaml found in current directory"
**And** exits with code 1

**Requirements Fulfilled:** FR1, AR6

---
### Story 1.2: CLI Spawn Agent with Story Context

As a Product Manager,
I want to spawn an AI agent with full story context passed to it,
So that the agent can begin working on a story without manual setup.

**Acceptance Criteria:**

**Given** a valid sprint-status.yaml exists with story "STORY-001"
**When** I run `ao spawn --story STORY-001`
**Then** the system spawns a new tmux session named "ao-story-001"
**And** passes the following story context to the agent:
  - Story ID and title
  - Full description
  - All acceptance criteria
  - Related dependencies (if any)
**And** the agent is ready to receive input within 10 seconds (NFR-P4)
**And** displays message: "Agent spawned for STORY-001 in session ao-story-001"

**Given** I want to spawn an agent in a specific tmux session
**When** I run `ao spawn --story STORY-001 --session my-session`
**Then** the agent is spawned in the specified session name
**And** the session is created if it doesn't exist

**Given** the story ID doesn't exist in sprint-status.yaml
**When** I run `ao spawn --story INVALID-ID`
**Then** displays error: "Story INVALID-ID not found in sprint-status.yaml"
**And** exits with code 1

**Given** tmux is not installed
**When** I run `ao spawn --story STORY-001`
**Then** displays error: "tmux runtime not available. Install tmux or configure alternative runtime"
**And** exits with code 1

**Requirements Fulfilled:** FR3, FR4, AR6

---
### Story 1.3: State Track Agent Assignments

As a Developer,
I want the system to track which agent is working on which story,
So that I can see assignment status and prevent duplicate assignments.

**Acceptance Criteria:**

**Given** an agent has been spawned for story "STORY-001"
**When** the spawn operation completes
**Then** the system creates an agent-registry entry with:
  - Agent ID (tmux session name)
  - Assigned story ID
  - Assignment timestamp
  - Agent status (spawning, active, idle, completed, blocked)
  - Story context hash (for conflict detection)

**Given** the agent-registry exists
**When** I query for agent "ao-story-001"
**Then** the system returns the agent's current assignment and status
**And** the query completes within 100ms (sub-millisecond cache read)

**Given** story "STORY-001" is already assigned to agent "ao-story-001"
**When** I attempt to spawn another agent for "STORY-001"
**Then** the system displays warning: "STORY-001 is already assigned to agent ao-story-001"
**And** prompts: "Do you want to spawn anyway? [y/N]"
**And** only spawns if I confirm with 'y'

**Given** the system restarts
**When** the agent-registry is loaded
**Then** all existing agent assignments are restored from persistent storage
**And** zombie entries (agents whose tmux sessions no longer exist) are marked as "disconnected"

**Requirements Fulfilled:** FR2, FR5, AR2, AR3

---
### Story 1.4: CLI View Story/Agent Status

As a Developer,
I want to view the status of stories and their assigned agents,
So that I can quickly understand what work is in progress.

**Acceptance Criteria:**

**Given** multiple agents are working on stories
**When** I run `ao status`
**Then** the system displays a table showing:
  - Story ID and title
  - Assigned agent (or "Unassigned")
  - Agent status (🟢 active, 🟡 idle, 🔴 blocked, ⚫ disconnected)
  - Time since last activity
  - Story status (todo, in-progress, done, blocked)
**And** the output is comprehensible within 1 second (UX1)

**Given** I want details about a specific story
**When** I run `ao status STORY-001`
**Then** the system displays:
  - Full story title and description
  - Assigned agent ID and status
  - Story acceptance criteria
  - Related stories (dependencies and dependents)
  - Recent activity log (last 5 events)

**Given** story "STORY-001" has no assigned agent
**When** I run `ao status STORY-001`
**Then** displays "Unassigned" in the agent field
**And** shows the story is ready to be picked up

**Given** I run `ao status --agent ao-story-001`
**Then** the system displays only the status of that specific agent
**And** shows the agent's tmux session status (active/inactive)

**Requirements Fulfilled:** FR5, AR6, UX1

---
### Story 1.5: CLI Manual Story Assignment

As a Developer,
I want to manually assign a story to a specific agent,
So that I can override automatic assignment when needed.

**Acceptance Criteria:**

**Given** agent "ao-story-001" exists and is idle
**When** I run `ao assign STORY-002 ao-story-001`
**Then** the system assigns STORY-002 to agent ao-story-001
**And** updates the agent-registry with the new assignment
**And** displays: "Assigned STORY-002 to agent ao-story-001"

**Given** agent "ao-story-001" is already working on a story
**When** I run `ao assign STORY-002 ao-story-001`
**Then** the system displays warning: "Agent ao-story-001 is already assigned to STORY-001"
**And** prompts: "Do you want to reassign? [y/N]"
**And** only reassigns if I confirm with 'y'

**Given** agent "ao-story-001" doesn't exist
**When** I run `ao assign STORY-002 ao-story-001`
**Then** displays error: "Agent ao-story-001 not found"
**And** exits with code 1

**Given** STORY-002 is already assigned to another agent
**When** I run `ao assign STORY-002 ao-story-001`
**Then** the system displays: "STORY-002 is currently assigned to ao-story-003"
**And** asks: "Reassign to ao-story-001? [y/N]"
**And** updates both agent registries if I confirm

**Given** I want to unassign a story
**When** I run `ao assign STORY-001 --unassign`
**Then** the system removes the assignment from agent-registry
**And** marks the story as "Unassigned"
**And** displays: "Unassigned STORY-001"

**Requirements Fulfilled:** FR7, AR6

---
### Story 1.6: Detection Agent Completion Detection

As a Developer,
I want the system to automatically detect when an agent completes its story,
So that the story status is updated without manual intervention.

**Acceptance Criteria:**

**Given** agent "ao-story-001" is working on STORY-001
**When** the agent completes its work and exits cleanly (exit code 0)
**Then** the system detects the agent completion
**And** updates STORY-001 status to "done" in sprint-status.yaml
**And** marks agent "ao-story-001" status as "completed"
**And** logs a completion event to the JSONL audit trail
**And** the detection and state update completes within 5 seconds (NFR-P1)

**Given** STORY-001 has dependent stories waiting on it
**When** STORY-001 is marked as "done"
**Then** the system identifies all stories that have STORY-001 as a dependency
**And** marks those stories as "ready" (no longer blocked)
**And** publishes an "unblocked" event for each dependent story

**Given** the agent exits with error code (non-zero)
**When** the system detects the failure
**Then** the agent status is marked as "failed"
**And** the story status is marked as "blocked"
**And** a desktop notification is sent: "Agent ao-story-001 failed for STORY-001"
**And** logs the failure to JSONL with exit code and available error context

**Given** the tmux session is manually killed by the user
**When** the system detects session termination
**Then** the agent is marked as "disconnected"
**And** the story remains in its current state
**And** displays info message: "Agent ao-story-001 disconnected (manual termination)"

**Requirements Fulfilled:** FR6, FR13, AR2, AR3

---
### Story 1.7: CLI Resume Blocked Story

As a Developer,
I want to resume an agent after resolving a blocking issue,
So that the agent can continue its work without losing context.

**Acceptance Criteria:**

**Given** STORY-001 is blocked due to a failed agent
**When** I have resolved the blocking issue
**And** I run `ao resume STORY-001`
**Then** the system respawns the agent in a new tmux session
**And** passes the original story context plus:
  - Summary of previous work done
  - Reason for previous blockage
  - Any manual changes made to resolve the issue
**And** marks STORY-001 status back to "in-progress"
**And** displays: "Resumed STORY-001 with agent ao-story-001-retry-1"

**Given** STORY-001 is not blocked
**When** I run `ao resume STORY-001`
**Then** displays info: "STORY-001 is not blocked (current status: in-progress)"
**And** exits without changes

**Given** STORY-001 is blocked but has no previous agent
**When** I run `ao resume STORY-001`
**Then** displays: "STORY-001 is blocked but has no previous agent to resume. Use 'ao spawn --story STORY-001' instead"
**And** exits with code 1

**Given** STORY-001 has been resumed multiple times
**When** I run `ao resume STORY-001`
**Then** the new agent session is named with increment: "ao-story-001-retry-2"
**And** the retry count is tracked in the agent-registry
**And** displays retry history: "Previous attempts: 2 (last: 2026-03-05 14:30)"

**Requirements Fulfilled:** FR8, AR6

---
### Story 1.8: CLI Fleet Monitoring Table

As a Tech Lead,
I want to view a htop-style table showing all agents and their stories,
So that I can quickly assess the overall fleet status at a glance.

**Acceptance Criteria:**

**Given** multiple agents are running across different stories
**When** I run `ao fleet`
**Then** the system displays a continuously updating table showing:
  - Agent ID column
  - Story ID column
  - Status column with color indicators (🟢 active, 🟡 idle, 🔴 blocked, ⚫ offline)
  - Time since last activity
  - Current story status
**And** the table refreshes every 2 seconds
**And** the output is comprehensible within 1 second (UX1)

**Given** the fleet table is displayed
**When** I press 'q'
**Then** the fleet view exits and returns to command line

**Given** an agent has been idle for more than 10 minutes
**When** I run `ao fleet`
**Then** that agent's status shows as "idle" with time since last activity
**And** idle agents are highlighted in yellow

**Given** an agent has failed or is blocked
**When** I run `ao fleet`
**Then** that agent's status shows as "blocked" in red
**And** the reason for blockage is displayed in a notes column

**Given** I run `ao fleet --watch=false`
**Then** the table displays once and exits (no continuous refresh)

**Given** I run `ao fleet --status blocked`
**Then** only blocked/failed agents are displayed
**And** the table is filtered to show only agents needing attention

**Requirements Fulfilled:** FR5, AR6, UX1

---

## Epic 2: Event Bus & State Synchronization

**Epic Goal:** Real-time state sync between Agent Orchestrator and BMAD tracker; event pub/sub; JSONL audit trail; automatic burndown recalculation

**FRs Covered:** FR9-FR16
**Phase:** 1 (MVP - Core infrastructure)

---

### Story 2.1: Redis Event Bus Implementation

As a Developer,
I want the system to have a Redis-backed event bus for pub/sub messaging,
So that state changes can be communicated across processes in real-time.

**Acceptance Criteria:**

**Given** Redis is installed and running
**When** the system initializes
**Then** a Redis connection is established using configuration from agent-orchestrator.yaml
**And** creates a Pub/Sub channel named "ao:events"
**And** enables AOF (Append Only File) persistence for durability

**Given** the event bus is initialized
**When** the system publishes an event
**Then** the event includes:
  - Event type (string)
  - Timestamp (ISO 8601)
  - Event ID (UUID)
  - Metadata (object with story/agent details)
**And** the event is published to "ao:events" channel
**And** event latency from publish to subscriber delivery is ≤500ms (NFR-P7)

**Given** Redis is unavailable at startup
**When** the system attempts to connect
**Then** displays error: "Redis connection failed. Event bus unavailable."
**And** continues in degraded mode (logs events locally, AR4)
**And** retries connection with exponential backoff (1s, 2s, 4s, 8s, 16s)

**Given** Redis connection is lost during operation
**When** the disconnection is detected
**Then** the system queues events in memory
**And** attempts reconnection with exponential backoff
**And** drains the queue when connection is restored
**And** displays warning: "Event bus disconnected. Events queued for replay."

**Given** the event bus is processing high volume
**When** 100+ events are published per second
**Then** no backlog accumulates (NFR-P6)
**And** burst events (1000 in 10 seconds) are handled without data loss (NFR-SC5)

**Requirements Fulfilled:** FR17, FR24, AR1, NFR-P6, NFR-P7, NFR-SC5, NFR-R6

---
### Story 2.2: Event Publishing Service

As a Developer,
I want a service that publishes events when stories change state,
So that all subscribers are notified of changes in real-time.

**Acceptance Criteria:**

**Given** an agent completes a story
**When** the completion is detected
**Then** the system publishes a "story.completed" event with:
  - Story ID
  - Previous status (in-progress)
  - New status (done)
  - Agent ID
  - Timestamp
  - Completion metadata (duration, files modified)

**Given** a story is spawned for an agent
**When** the spawn operation completes
**Then** the system publishes a "story.started" event with:
  - Story ID
  - Agent ID
  - Timestamp
  - Story context hash

**Given** a story becomes blocked
**When** the blockage is detected
**Then** the system publishes a "story.blocked" event with:
  - Story ID
  - Agent ID (if applicable)
  - Blockage reason
  - Timestamp
  - Related error details

**Given** multiple events are published rapidly
**When** duplicate events for the same story+status are detected
**Then** the system deduplicates and publishes only once (FR23)
**And** uses event deduplication window of 5 seconds

**Given** the event bus is unavailable
**When** an event should be published
**Then** the event is queued in memory
**And** logged to local file as backup
**And** publishes all queued events when bus is restored

**Requirements Fulfilled:** FR17, FR23, FR24

---
### Story 2.3: Event Subscription Service

As a Developer,
I want to subscribe to specific event types for targeted processing,
So that I can build services that react to relevant state changes.

**Acceptance Criteria:**

**Given** I want to process only story completion events
**When** I register a subscription for "story.completed"
**Then** the system delivers only "story.completed" events to my handler
**And** filters out all other event types

**Given** I want to handle multiple event types
**When** I register subscriptions for ["story.completed", "story.blocked"]
**Then** the system delivers both event types to my handler
**And** processes events in the order they were received

**Given** an event is received by a subscriber
**When** the subscriber processes the event
**Then** the system acknowledges delivery after successful processing
**And** only removes the event from the queue after acknowledgment

**Given** a subscriber throws an error while processing an event
**When** the error is caught
**Then** the event is returned to the queue for retry
**And** exponential backoff is applied (1s, 2s, 4s, 8s, 16s)
**And** after 5 failed attempts, the event is moved to dead letter queue

**Given** multiple subscribers are registered for the same event
**When** an event is published
**Then** all subscribers receive the event
**And** each subscriber processes independently

**Given** I want to unsubscribe from an event type
**When** I call unsubscribe with the event type
**Then** no further events of that type are delivered to my handler
**And** the subscription is removed within 100ms

**Requirements Fulfilled:** FR18, FR23, AR5

---
### Story 2.4: JSONL Audit Trail

As a Developer,
I want all state transitions logged to an append-only JSONL file,
So that I have an immutable audit trail for troubleshooting and recovery.

**Acceptance Criteria:**

**Given** an event is published to the event bus
**When** the event is published
**Then** the event is appended to events.jsonl in the project directory
**And** each line is a valid JSON object containing the full event
**And** the file is append-only (no modifications to existing lines)

**Given** the events.jsonl file exists
**When** I read the file
**Then** each line represents one event in chronological order
**And** each line contains:
  - Event ID (UUID)
  - Event type
  - Timestamp
  - Event data (story/agent details)
  - Event hash (SHA-256 for integrity verification)

**Given** the system restarts after a crash
**When** the event bus recovers
**Then** the system replays events from events.jsonl to restore state
**And** verifies event integrity using SHA-256 hashes
**And** alerts if corrupted events are detected (NFR-R10)

**Given** the events.jsonl file grows large (>10MB)
**When** new events are appended
**Then** the system archives old events to events.jsonl.archive
**And** keeps only the most recent 10,000 events in the active file
**And** maintains a separate index for archived events

**Given** I want to query the audit trail
**When** I run `ao logs --event story.completed --last 10`
**Then** the system displays the last 10 story.completed events
**And** outputs in human-readable format with timestamps

**Given** file system is read-only
**When** an event should be logged
**Then** the system displays warning: "Cannot write to events.jsonl (read-only filesystem)"
**And** continues operation with in-memory event buffering
**And** alerts user about audit trail gap

**Requirements Fulfilled:** FR14, NFR-R8, NFR-R10

---
### Story 2.5: State Manager with Write-Through Cache

As a Developer,
I want the state manager to use write-through caching with YAML as authoritative storage,
So that state reads are fast and data is never lost.

**Acceptance Criteria:**

**Given** the state manager initializes
**When** it loads for the first time
**Then** it reads sprint-status.yaml into an in-memory cache
**And** cache reads complete in sub-millisecond time (AR2)
**And** YAML file remains the authoritative source

**Given** a story status changes
**When** the update is applied
**Then** the system writes to sprint-status.yaml first (write-through)
**And** then updates the in-memory cache
**And** returns success only after both operations complete
**And** maintains a version stamp on each update for conflict detection

**Given** I read story state
**When** the state is requested
**Then** the system reads from the in-memory cache (not the file)
**And** returns the cached state within 1ms

**Given** sprint-status.yaml is modified externally
**When** the file watcher detects the change (Story 2.6)
**Then** the cache is invalidated and reloaded
**And** a "state.external_update" event is published
**And** cache reload completes within 100ms

**Given** a write operation fails (disk full, permissions)
**When** the error is detected
**Then** the in-memory cache is NOT updated
**And** an error is returned with details
**And** the state remains unchanged

**Given** concurrent writes occur
**When** two processes attempt to update the same story
**Then** the version stamp prevents silent overwrites (NFR-R7)
**And** the second write detects the version mismatch
**And** returns a conflict error requiring manual resolution

**Requirements Fulfilled:** FR9, FR16, AR2, NFR-R7

---
### Story 2.6: YAML File Watcher

As a Developer,
I want the system to detect external changes to sprint-status.yaml,
So that state remains synchronized when the file is edited outside the system.

**Acceptance Criteria:**

**Given** the system is running
**When** sprint-status.yaml is modified by an external editor
**Then** the file watcher detects the change within 1 second
**And** triggers a cache invalidation
**And** reloads the YAML into the in-memory cache
**And** publishes a "state.external_update" event with:
  - Previous version stamp
  - New version stamp
  - List of changed stories

**Given** an external update creates a conflict
**When** the file watcher detects the change
**Then** the system compares version stamps
**And** if versions conflict, displays: "Conflict detected: sprint-status.yaml was modified externally"
**And** shows a diff of conflicting changes
**And** prompts user to resolve: "[M]erge, [K]eep local, [A]ccept external"

**Given** I choose to merge conflicts
**When** the merge is selected
**Then** the system opens a merge view showing both versions
**And** allows selective acceptance of changes
**And** creates a merged version stamp
**And** logs the conflict resolution to JSONL audit trail

**Given** sprint-status.yaml is deleted externally
**When** the file watcher detects deletion
**Then** the system displays error: "sprint-status.yaml was deleted"
**And** prompts: "Restore from backup? [y/N]"
**And** if confirmed, restores from the most recent backup

**Given** the file watcher cannot read the file (permissions, locks)
**When** the read fails
**Then** the system displays warning: "Cannot read sprint-status.yaml: {reason}"
**And** continues with cached state
**And** retries read operation every 5 seconds

**Given** multiple rapid edits occur externally
**When** changes are detected
**Then** the system debounces file events (500ms window)
**And** processes only the final state after edits settle
**And** avoids unnecessary cache reloads

**Requirements Fulfilled:** FR11, FR15, AR2

---
### Story 2.7: Conflict Resolution with Optimistic Locking

As a Developer,
I want the system to detect and resolve conflicting state updates,
So that no data is lost when multiple sources update the same story.

**Acceptance Criteria:**

**Given** a story has version stamp "v1"
**When** I attempt to update with version "v1"
**Then** the update proceeds
**And** the story is updated to version "v2"
**And** the version stamp is incremented

**Given** a story has version "v2" but I'm trying to update with "v1"
**When** I attempt the update
**Then** the system detects the version mismatch
**And** returns error: "Conflict: STORY-001 has version v2, but your update has version v1"
**And** does NOT apply the update
**And** prompts for conflict resolution

**Given** a version conflict is detected
**When** I choose to view the conflict
**Then** the system displays:
  - Current state (v2) with changes highlighted
  - My proposed state (v1) with changes highlighted
  - A side-by-side diff of the differences
**And** offers resolution options:
  - "[O]verwrite - Apply my changes (discards current)"
  - "[R]etry - Refresh and reapply my changes"
  - "[M]erge - Manually merge both versions"

**Given** I choose to merge
**When** the merge option is selected
**Then** the system opens an interactive merge interface
**And** shows each conflicting field with both values
**And** allows me to select which value to keep for each field
**And** creates a new version "v3" with merged values
**And** logs the merge to JSONL audit trail

**Given** I choose to overwrite
**When** overwrite is confirmed
**Then** the system applies my changes
**And** sets version to "v3"
**And** logs: "Conflict resolved by overwrite for STORY-001 by user"

**Given** automatic conflict resolution is needed (non-interactive)
**When** a conflict occurs in CLI mode
**Then** the system returns exit code 2 (conflict)
**And** outputs JSON with conflict details for programmatic handling
**And** does NOT silently overwrite or discard data

**Requirements Fulfilled:** FR16, NFR-R7

---
### Story 2.8: State Sync to BMAD Tracker

As a Product Manager,
I want state changes to sync bidirectionally with the BMAD tracker,
So that the sprint status stays in sync across both systems.

**Acceptance Criteria:**

**Given** an agent completes STORY-001 in Agent Orchestrator
**When** the completion is detected
**Then** the system sends a state update to BMAD tracker
**And** the update completes within 5 seconds (NFR-P1, NFR-P10)
**And** STORY-001 is marked as "done" in BMAD
**And** a "sync.completed" event is logged to JSONL

**Given** a story is moved to "done" in BMAD tracker
**When** the external change is detected via BMAD plugin
**Then** the system updates sprint-status.yaml with the new status
**And** the update completes within 5 seconds (NFR-P1, NFR-P11)
**And** the in-memory cache is invalidated and reloaded
**And** a "sync.external_update" event is published

**Given** the BMAD tracker is unavailable
**When** a state sync is attempted
**Then** the system queues the update for retry
**And** displays warning: "BMAD tracker unavailable. State queued for sync."
**And** retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
**And** continues in degraded mode (AR3)

**Given** BMAD tracker returns a sync error
**When** the error is received
**Then** the system logs the error to JSONL
**And** marks the sync as "failed" in the event log
**And** after 5 retry attempts, moves to dead letter queue
**And** sends a notification: "BMAD sync failed for STORY-001"

**Given** conflicting states exist (Agent Orchestrator says "done", BMAD says "in-progress")
**When** the conflict is detected
**Then** the system uses timestamp-based resolution (last write wins)
**And** logs the conflict with both timestamps
**And** publishes a "sync.conflict_resolved" event
**And** updates both systems to the winning state

**Given** I want to trigger a manual sync
**When** I run `ao sync --from-bmad`
**Then** the system fetches all story states from BMAD tracker
**And** updates sprint-status.yaml with BMAD state
**And** displays: "Synced 15 stories from BMAD tracker"
**And** completes within 10 seconds for 100 stories (NFR-SC3)

**Requirements Fulfilled:** FR10, FR11, NFR-P1, NFR-P10, NFR-P11, NFR-R3

---

## Epic 3: Dashboard & Real-Time Monitoring

**Epic Goal:** Live sprint burndown; fleet monitoring matrix; agent session cards; event audit trails; conflict detection alerts

**FRs Covered:** FR17-FR24 (Event Bus & Notifications), FR25-FR32 (Dashboard & Monitoring)
**Phase:** 2 (After CLI MVP is stable)

---

### Story 3.1: Notification Service Core

As a Developer,
I want a central notification service that queues, deduplicates, and routes notifications,
So that critical events reach users through their preferred channels.

**Acceptance Criteria:**

**Given** a critical event occurs (agent blocked, conflict detected)
**When** the event is published
**Then** the notification service receives the event via event bus subscription
**And** adds the notification to a priority queue
**And** assigns priority based on event type (critical > warning > info)

**Given** duplicate notifications are queued
**When** deduplication runs
**Then** notifications with identical event ID + type within 5 minutes are deduplicated (AR4)
**And** only one notification is delivered
**And** the dedup count is tracked for metrics

**Given** a notification is ready for delivery
**When** the notification is processed
**Then** the service routes to configured notification plugins:
  - Desktop plugin for native OS notifications
  - Slack plugin for team alerts
  - Webhook plugin for custom integrations
**And** each plugin receives standardized notification format:
  - Event ID
  - Event type
  - Priority (critical/warning/info)
  - Title and message
  - Timestamp
  - Action URL (if applicable)

**Given** the notification queue depth exceeds 50 items
**When** the threshold is crossed
**Then** the service publishes a "notification.backlog" event (FR21)
**And** displays warning: "Notification backlog detected: {count} pending"

**Given** a notification plugin fails to deliver
**When** the delivery error is caught
**Then** the service retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
**And** after 3 failed attempts, moves to dead letter queue
**And** logs delivery failure to JSONL

**Given** notification preferences are configured
**When** I configure notify.onBlock: "desktop,slack"
**Then** only desktop and slack plugins receive blocked agent notifications
**And** other event types respect their own preferences

**Requirements Fulfilled:** FR18, FR19, FR21, FR22, FR23, AR4

---
### Story 3.2: Desktop Notification Plugin

As a Developer,
I want to receive native desktop notifications for critical events,
So that I'm immediately alerted when my intervention is needed.

**Acceptance Criteria:**

**Given** an agent becomes blocked
**When** the notification service routes to desktop plugin
**Then** a native OS notification appears with:
  - Title: "Agent Blocked: ao-story-001"
  - Body: "STORY-001 requires human intervention: {reason}"
  - Icon: 🔴 red indicator
  - Sound: Default notification sound
**And** clicking the notification opens the terminal with `ao status STORY-001`

**Given** a conflict is detected
**When** the notification service routes to desktop plugin
**Then** a native OS notification appears with:
  - Title: "Conflict Detected"
  - Body: "Multiple agents assigned to STORY-001"
  - Icon: 🟡 yellow indicator
**And** clicking opens the conflict resolution interface

**Given** multiple critical events occur in quick succession
**When** notifications are delivered
**Then** they are coalesced into a single notification: "3 agents blocked, 1 conflict"
**And** the coalesced notification shows summary count
**And** clicking expands to show all individual events

**Given** the system is in "focus mode" (do not disturb)
**When** a non-critical notification arrives
**Then** the notification is queued silently
**And** displays only when focus mode ends
**And** critical notifications (conflicts) always break through

**Given** desktop notifications are not supported (headless server)
**When** the plugin initializes
**Then** it detects the missing capability gracefully
**And** logs: "Desktop notifications not supported on this system"
**And** routes notifications to fallback plugin (slack/webhook)

**Given** I want to test notifications
**When** I run `ao notify --test --type desktop`
**Then** a test notification is sent
**And** displays: "Test notification from Agent Orchestrator"
**And** confirms delivery: "Desktop notification sent successfully"

**Requirements Fulfilled:** FR20, FR22

---
### Story 3.3: Web Dashboard Foundation

As a Developer,
I want a Next.js web dashboard that receives real-time updates via Server-Sent Events,
So that I can monitor agent activity without refreshing the page.

**Acceptance Criteria:**

**Given** I start the web server
**When** I navigate to http://localhost:3000
**Then** the dashboard home page loads within 2 seconds (NFR-P3)
**And** displays a navigation menu with:
  - Dashboard (home)
  - Fleet
  - Events
  - Settings
**And** shows a connection status indicator (🟢 connected, 🔴 disconnected)

**Given** the dashboard is loaded
**When** real-time events occur
**Then** the page receives updates via Server-Sent Events (SSE)
**And** updates the UI without page refresh (UX2)
**And** shows a subtle flash animation when data changes

**Given** an SSE connection is established
**When** the connection is active
**Then** the client receives events of type:
  - story.started
  - story.completed
  - story.blocked
  - agent.status_changed
**And** each event includes full data payload

**Given** the SSE connection drops
**When** the disconnection is detected
**Then** the connection status changes to "disconnected" in red
**And** the client attempts reconnection with exponential backoff (1s, 2s, 4s, 8s)
**And** displays: "Reconnecting to event stream..."
**And** when reconnected, fetches any missed events from the event log

**Given** the dashboard needs API data
**When** it makes requests to /api/sprint/status
**Then** the API returns current sprint state as JSON
**And** includes all stories with statuses and assignments
**And** completes within 500ms for 100 stories (NFR-P8)

**Given** I want to view the dashboard on mobile
**When** I access from a mobile browser
**Then** the layout is responsive and adapts to screen size
**And** critical information (agent status) remains visible
**And** navigation is touch-friendly

**Requirements Fulfilled:** FR15, NFR-P3, AR7, UX2

---
### Story 3.4: Sprint Burndown Chart Component

As a Product Manager,
I want to see a live sprint burndown chart that updates automatically,
So that I can track sprint progress in real-time.

**Acceptance Criteria:**

**Given** I view the dashboard home page
**When** the page loads
**Then** a burndown chart is displayed showing:
  - X-axis: Sprint days (day 1 to day N)
  - Y-axis: Remaining story points
  - Ideal burndown line (dashed, straight line from start to 0)
  - Actual burndown line (solid, updated in real-time)
  - Today marker (vertical line indicating current day)

**Given** a story is completed
**When** the "story.completed" event is received via SSE
**Then** the burndown chart updates within 2 seconds (NFR-P2)
**And** the actual line drops by the completed story's points
**And** the chart animates the change smoothly

**Given** the sprint starts with 50 story points
**When** day 1 begins
**Then** the chart shows:
  - Ideal line: Starts at 50, ends at 0 on final day
  - Actual line: Starts at 50, updates as stories complete
  - Remaining points calculated dynamically from story statuses

**Given** stories are completed ahead of schedule
**When** the actual line is below the ideal line
**Then** the line is colored green (ahead of schedule)
**And** an "On Track" badge is displayed

**Given** stories are behind schedule
**When** the actual line is above the ideal line
**Then** the line is colored red (behind schedule)
**And** an "At Risk" badge is displayed
**And** the chart shows predicted completion date based on current velocity

**Given** I hover over a data point on the actual line
**When** the hover interaction occurs
**Then** a tooltip displays:
  - Date
  - Remaining points
  - Stories completed that day
  - Predicted completion (if behind)

**Given** I want to export the burndown data
**When** I click the "Export" button
**Then** the system downloads a CSV file with daily burndown data
**And** includes date, remaining points, completed points, and delta

**Requirements Fulfilled:** FR12, FR25, NFR-P2

---
### Story 3.5: Fleet Monitoring Matrix

As a Tech Lead,
I want to view a fleet monitoring matrix showing all active agents,
So that I can assess overall system health at a glance.

**Acceptance Criteria:**

**Given** I navigate to the Fleet page
**When** the page loads
**Then** a 3-column grid layout is displayed (AR7):
  - Column 1: Active agents (🟢)
  - Column 2: Idle agents (🟡)
  - Column 3: Blocked/Failed agents (🔴)
**And** each agent is displayed as a card with:
  - Agent ID
  - Story ID and title
  - Status indicator with color
  - Time since last activity
  - Current story progress (if applicable)

**Given** an agent transitions from active to idle
**When** the "agent.status_changed" event is received
**Then** the agent card moves from Active to Idle column with animation
**And** the status indicator changes from 🟢 to 🟡
**And** the update completes within 3 seconds (NFR-P5)

**Given** an agent becomes blocked
**When** the "story.blocked" event is received
**Then** the agent card moves to Blocked column
**And** the card shows the blockage reason
**And** a "Resume" button is displayed on the card
**And** clicking "Resume" opens the resume modal

**Given** I click on an agent card
**When** the card is clicked
**Then** a detail modal opens showing:
  - Full story details (title, description, acceptance criteria)
  - Agent activity timeline (last 10 events)
  - Related stories (dependencies and dependents)
  - Actions: Resume, View Logs, Assign to Different Agent

**Given** I filter to show only blocked agents
**When** I select the "Blocked" filter
**Then** only Blocked column is displayed
**And** the grid expands to fill available space
**And** the URL updates to /fleet?status=blocked

**Given** no agents are currently running
**When** I view the Fleet page
**Then** a "No active agents" message is displayed
**And** a "Spawn Agent" button is shown
**And** clicking opens the spawn modal

**Given** the fleet has 20+ agents
**When** the page displays
**Then** each column is scrollable independently
**And** agent cards use compact layout to show more agents
**And** performance remains smooth with 100+ agents (NFR-SC3)

**Requirements Fulfilled:** FR26, FR27, NFR-P5, AR7

---
### Story 3.6: Agent Session Cards with Activity History

As a Developer,
I want to click on an agent card and see its detailed activity history,
So that I can understand what work the agent has done and troubleshoot issues.

**Acceptance Criteria:**

**Given** I click on an agent card in the fleet matrix
**When** the detail modal opens
**Then** the agent session card displays:
  - Agent ID and session name
  - Assigned story with title and ID
  - Current status (coding, blocked, idle, completed)
  - Session duration (time since spawn)
  - Last activity timestamp
**And** the modal is draggable and resizable

**Given** the session card is open
**When** I scroll down
**Then** the activity timeline is displayed showing:
  - Events in chronological order (newest first)
  - Each event shows: timestamp, event type, description
  - Color coding by event type (🟢 started, 🔴 blocked, ✅ completed)
  - Last 50 events for the session

**Given** the agent is blocked
**When** I view the activity timeline
**Then** the most recent event is a "story.blocked" event
**And** clicking the event shows:
  - Blockage reason
  - Error message or stack trace (if applicable)
  - "Resolve" or "Resume" action buttons
**And** the blocked event is highlighted in red

**Given** I want to see the agent's logs
**When** I click the "View Logs" button
**Then** the session card expands to show:
  - Last 100 lines of agent output
  - Real-time log streaming as new output is generated
  - Log filtering by severity (error, warning, info)
  - "Download Logs" button to save full logs

**Given** the agent is currently active (coding)
**When** I view the session card
**Then** a pulsing green indicator shows the agent is working
**And** the activity timeline updates in real-time as new events occur
**And** a "Ping" button sends a heartbeat to verify agent responsiveness

**Given** the agent has been idle for >10 minutes
**When** I view the session card
**Then** a yellow "Idle" badge is displayed
**And** the idle duration is shown
**And** "Terminate" and "Resume" buttons are available

**Given** I want to assign the story to a different agent
**When** I click "Reassign"
**Then** a modal opens showing available agents
**And** I can select a new agent or create a new one
**And** upon confirmation, the story is reassigned and current agent is terminated

**Requirements Fulfilled:** FR27, FR28, FR30

---
### Story 3.7: Event Audit Trail Viewer

As a Tech Lead,
I want to view and search the event audit trail from the dashboard,
So that I can troubleshoot issues and understand system behavior.

**Acceptance Criteria:**

**Given** I navigate to the Events page
**When** the page loads
**Then** a searchable event table is displayed showing:
  - Event ID (clickable for details)
  - Timestamp (human-readable format)
  - Event type (color-coded badge)
  - Related story/agent IDs
  - Event summary
**And** the most recent 100 events are loaded by default
**And** the page loads within 2 seconds (NFR-P3)

**Given** I want to search for specific events
**When** I use the search box
**Then** I can search by:
  - Event type (e.g., "story.completed")
  - Story ID (e.g., "STORY-001")
  - Agent ID (e.g., "ao-story-001")
  - Time range (date picker or preset: "Last hour", "Last 24h", "Last 7 days")
**And** results update in real-time as I type

**Given** I filter to "story.blocked" events
**When** the filter is applied
**Then** only blocked events are displayed
**And** each blocked event shows:
  - Story ID
  - Agent ID (if applicable)
  - Blockage reason
  - Timestamp
**And** clicking an event opens a detail modal

**Given** I click on an event to view details
**When** the detail modal opens
**Then** the full event payload is displayed as formatted JSON
**And** related events are linked (e.g., story.started → story.blocked → story.resumed)
**And** "Previous" and "Next" buttons navigate to adjacent events
**And** a "Copy JSON" button copies the event to clipboard

**Given** new events occur while I'm viewing the Events page
**When** the events are received via SSE
**Then** the table updates in real-time
**And** new events are highlighted with a flash animation
**And** the event count indicator shows: "Showing 100 of 1,247 events (3 new)"
**And** a "Load new events" button appears when there are updates

**Given** I want to export the event log
**When** I click "Export Events"
**Then** the system downloads a JSONL file with filtered events
**And** the filename includes date range: "events-2026-03-01-to-2026-03-05.jsonl"
**And** large exports (>10MB) show a progress indicator

**Given** the event log has 10,000+ events
**When** I navigate to the Events page
**Then** pagination controls are displayed (showing 100 per page)
**And** I can jump to specific date ranges
**And** infinite scroll loads more events as I scroll down

**Requirements Fulfilled:** FR32, NFR-P3

---
### Story 3.8: Workflow Health Metrics Panel

As a DevOps Engineer,
I want to see workflow health metrics on the dashboard,
So that I can monitor system performance and identify issues proactively.

**Acceptance Criteria:**

**Given** I view the dashboard home page
**When** the page loads
**Then** a "Workflow Health" panel is displayed showing:
  - Event bus status (🟢 connected, 🔴 disconnected, 🟡 degraded)
  - Events processed per second (with sparkline chart)
  - Sync latency to BMAD tracker (current + average)
  - Active agent count
  - Blocked agent count
  - Uptime percentage (last 24h)
**And** all metrics update in real-time via SSE

**Given** the event bus is healthy
**When** I view the metrics
**Then** event bus status shows 🟢 "Connected"
**And** events/sec shows current rate (e.g., "12 events/sec")
**And** a sparkline shows events/sec over last hour
**And** alert threshold is configured (NFR-R1: if events/sec > 100 for >5min, warn about potential spam)

**Given** sync latency increases above 5 seconds
**When** the threshold is crossed
**Then** the sync latency metric turns red (🔴)
**And** a warning banner appears: "BMAD sync latency elevated: 8.2s"
**And** clicking the banner shows troubleshooting steps
**And** the metric persists the alert state for 30 minutes

**Given** multiple agents are blocked
**When** the blocked agent count exceeds 3
**Then** the blocked agent count turns red
**And** a "Review Blocked Agents" action button appears
**And** clicking navigates to the Fleet page filtered to blocked agents

**Given** the system has been running for 24h
**When** I view the uptime metric
**Then** it shows: "99.2% uptime (downtime: 8m 32s)"
**And** hovering shows downtime events with timestamps
**And** clicking shows a detailed uptime report

**Given** I want to set up custom alert thresholds
**When** I navigate to Settings > Health Alerts
**Then** I can configure thresholds for:
  - Max sync latency (default: 5000ms)
  - Min events/sec (default: 0, warns if event bus stalls)
  - Max blocked agents (default: 3)
  - Max queue depth (default: 50)
**And** I can enable/disable notifications for each threshold

**Given** a configured threshold is crossed
**When** the alert triggers
**Then** a desktop notification is sent (if enabled)
**And** the metric is highlighted on the health panel
**And** the alert is logged to the event audit trail
**And** slack/webhook notifications are sent (if configured)

**Given** I click on a metric for details
**When** the metric detail modal opens
**Then** historical data for the metric is displayed as a line chart
**And** the time range can be adjusted (1h, 6h, 24h, 7d)
**And** anomalous data points are highlighted
**And** related events are shown below the chart

**Requirements Fulfilled:** FR29, FR31, NFR-R1

---

## Epic 4: Error Handling & Graceful Degradation

**Epic Goal:** Detect blocked agents; retry with exponential backoff; graceful degradation when services unavailable; dead letter queue

**FRs Covered:** FR33-FR40
**Phase:** 1 (MVP - Core reliability)

---

### Story 4.1: Blocked Agent Detection

As a Developer,
I want the system to automatically detect when an agent becomes blocked,
So that I can be notified and intervene when needed.

**Acceptance Criteria:**

**Given** agent "ao-story-001" is active and working
**When** the agent produces no activity (no events, no log output) for 10 minutes
**Then** the system marks the agent as "blocked"
**And** publishes a "agent.blocked" event with:
  - Agent ID
  - Time since last activity
  - Reason: "No activity detected for 10 minutes"
**And** sends a desktop notification: "Agent ao-story-001 blocked (inactive for 10m)"

**Given** the blocked threshold is configured
**When** I set agent.blockTimeout to 5 minutes in agent-orchestrator.yaml
**Then** agents are marked as blocked after 5 minutes of inactivity
**And** the configuration is validated at startup (min: 1m, max: 60m)

**Given** an agent is marked as blocked
**When** I view the fleet status
**Then** the agent card shows in the Blocked column
**And** displays: "Blocked: No activity for 10m"
**And** a "Resume" button is available

**Given** an agent was marked as blocked
**When** the agent resumes activity (produces new events)
**Then** the system automatically marks the agent as "active"
**And** publishes an "agent.resumed" event
**And** logs: "Agent ao-story-001 resumed after 10m blockage"

**Given** I want to configure different thresholds per agent type
**When** I configure agent-type specific timeouts
**Then** "claude-code" agents use 10m threshold
**And** "codex" agents use 5m threshold
**And** "aider" agents use 15m threshold
**And** the configuration is applied based on agent type

**Given** an agent is intentionally paused (not blocked)
**When** I run `ao pause ao-story-001`
**Then** the agent is marked as "paused" (not "blocked")
**And** the blocked detection is suspended for this agent
**And** "ao resume ao-story-001" resumes the agent and detection

**Given** an agent exits cleanly (exit code 0)
**When** the completion is detected
**Then** the agent is marked as "completed" (not "blocked")
**And** no blocked notification is sent

**Requirements Fulfilled:** FR33, FR35

---
### Story 4.2: Error Logging with Context

As a Developer,
I want all errors logged with sufficient context for troubleshooting,
So that I can diagnose issues quickly without reproducing them.

**Acceptance Criteria:**

**Given** an error occurs in any component
**When** the error is caught
**Then** the system logs a structured error entry containing:
  - Error ID (UUID for correlation)
  - Timestamp (ISO 8601 with milliseconds)
  - Error type and code
  - Error message
  - Stack trace (if applicable)
  - Component/service that threw the error
  - Related story ID (if applicable)
  - Related agent ID (if applicable)
  - Full execution context (request ID, user ID, environment variables)
  - Snapshot of relevant state (YAML version, cache state)

**Given** an error is logged
**When** I query for the error by ID
**Then** the system returns the complete error context
**And** I can trace the error through the system using the error ID
**And** related events are linked (events with same correlation ID)

**Given** an error occurs during a BMAD sync operation
**When** the error is logged
**Then** the log includes:
  - Sync operation type (read/write)
  - BMAD endpoint URL
  - Request payload (sanitized, no secrets)
  - Response status code
  - Response body (if error response)
  - Retry attempt number

**Given** an error occurs during agent spawn
**When** the error is logged
**Then** the log includes:
  - Story ID and context
  - Runtime type (tmux, process, docker)
  - Spawn command and arguments
  - Exit code and stderr output
  - Environment variables (sanitized, no API keys)

**Given** sensitive information is present (API keys, passwords)
**When** the error is logged
**Then** all secrets are redacted before logging (NFR-S2)
**And** redaction markers show what was removed: "[REDACTED: api_key]"
**And** no sensitive data appears in logs or error messages

**Given** errors occur rapidly (>10 per second)
**When** the error rate is high
**Then** the system detects error spam
**And** logs a summary: "50 errors occurred in last 5 seconds (latest: {error_type})"
**And** individual errors are still logged to JSONL
**And** a notification is sent: "High error rate detected"

**Given** I want to search errors
**When** I run `ao errors --type sync --last 1h`
**Then** the system displays matching errors with context
**And** outputs in a readable table format
**And** includes error ID for full lookup

**Requirements Fulfilled:** FR37, NFR-S2

---
### Story 4.3: Retry with Exponential Backoff and Circuit Breaker

As a Developer,
I want failed operations to be retried with exponential backoff and circuit breaker protection,
So that transient failures don't cascade and overload the system.

**Acceptance Criteria:**

**Given** a transient error occurs (network timeout, temporary service unavailable)
**When** the operation fails
**Then** the system queues the operation for retry
**And** applies exponential backoff: 1s, 2s, 4s, 8s, 16s
**And** logs each retry attempt with context

**Given** an operation fails 5 times in succession
**When** the 5th failure occurs
**Then** the circuit breaker opens for that operation type
**And** subsequent operations of that type fail immediately (no retry)
**And** the circuit breaker remains open for 30 seconds (AR5)
**And** after 30 seconds, the breaker enters "half-open" state
**And** the next operation is attempted as a probe
**And** if the probe succeeds, the breaker closes (normal operation resumes)
**And** if the probe fails, the breaker opens again for another 30 seconds

**Given** the circuit breaker is open
**When** I check system status
**Then** the circuit breaker state is displayed:
  - "OPEN: BMAD sync operations paused (opened 12s ago, closes in 18s)"
**And** a notification was sent when the breaker opened
**And** the breaker state is visible on the health panel

**Given** I want to configure retry behavior
**When** I set retry configuration in agent-orchestrator.yaml:
```yaml
retry:
  maxAttempts: 7
  backoffMs: 1000
  maxBackoffMs: 60000
  circuitBreaker:
    failureThreshold: 5
    openDurationMs: 30000
```
**Then** the system applies the custom retry policy
**And** circuit breaker thresholds match the configuration

**Given** a non-transient error occurs (authentication failure, not found)
**When** the error is detected as non-retryable
**Then** the operation is NOT retried
**And** it's moved directly to the dead letter queue
**And** logged as "Non-retryable error: {error_type}"

**Given** a BMAD sync operation fails and is being retried
**When** the retry is scheduled
**Then** the sync status shows: "Retrying in 4s (attempt 3/5)"
**And** the story being synced remains in current state
**And** when retry succeeds, the sync completes normally

**Given** I want to manually retry a failed operation
**When** I run `ao retry --error-id <error-id>`
**Then** the operation is retried immediately (bypassing circuit breaker)
**And** the result is displayed
**And** if successful, the error is marked as resolved

**Requirements Fulfilled:** FR38, AR5

---
### Story 4.4: Graceful Degradation Mode

As a Developer,
I want the system to continue operating in degraded mode when services are unavailable,
So that partial functionality is maintained instead of complete failure.

**Acceptance Criteria:**

**Given** the event bus (Redis) becomes unavailable
**When** the connection loss is detected
**Then** the system enters "degraded mode: event-bus-unavailable"
**And** displays warning: "Event bus unavailable. Running in degraded mode."
**And** events are logged to local file (events.jsonl) instead
**And** in-memory event queue accumulates events
**And** CLI commands continue to function (NFR-R2)
**And** publishes "system.degraded" event to local log

**Given** degraded mode is active (event bus unavailable)
**When** I run `ao spawn --story STORY-001`
**Then** the agent spawns successfully
**And** the "story.started" event is logged to events.jsonl
**And** the event is queued in memory for later publishing
**And** the operation completes without error

**Given** the BMAD tracker becomes unavailable
**When** sync attempts fail
**Then** the system enters "degraded mode: bmad-unavailable"
**And** displays warning: "BMAD tracker unavailable. State sync queued."
**And** sprint-status.yaml updates continue locally
**And** sync operations are queued with timestamps
**And** continues to track agents and stories locally

**Given** the event bus recovers
**When** the connection is re-established
**Then** the system exits degraded mode
**And** displays: "Event bus reconnected. Draining queued events..."
**And** publishes all queued events in order
**And** backlogs drain within 30 seconds (NFR-SC6)
**And** publishes "system.recovered" event

**Given** the BMAD tracker recovers
**When** the connection is restored
**Then** the system exits degraded mode for sync
**And** displays: "BMAD tracker reconnected. Syncing queued updates..."
**And** processes queued sync operations in order
**And** syncs all local changes to BMAD
**And** handles conflicts using timestamp-based resolution

**Given** both event bus AND BMAD are unavailable
**When** multiple services are down
**Then** the system enters "degraded mode: multiple-services-unavailable"
**And** displays a summary: "Degraded: Event bus + BMAD unavailable"
**And** all core CLI operations continue to function
**And** local state is maintained fully
**And** dashboard shows degraded status prominently

**Given** I'm in degraded mode
**When** I run `ao health`
**Then** the output shows:
  - Overall status: "Degraded"
  - Event bus: "❌ Unavailable"
  - BMAD tracker: "❌ Unavailable"
  - Local state: "✅ Operational"
  - Queued operations: "12 events, 5 syncs pending"

**Given** degraded mode persists for >10 minutes
**When** the threshold is crossed
**Then** a notification is sent: "System in degraded mode for 10+ minutes"
**And** the alert persists until services recover
**And** admin is prompted to investigate service availability

**Requirements Fulfilled:** FR34, NFR-R3, NFR-R4

---
### Story 4.5: Dead Letter Queue

As a Developer,
I want operations that failed after all retries to be moved to a dead letter queue,
So that I can review and manually handle them later.

**Acceptance Criteria:**

**Given** an operation fails after 5 retry attempts
**When** the final retry fails
**Then** the operation is moved to the dead letter queue (DLQ)
**And** the DLQ entry contains:
  - Original operation type (sync, spawn, etc.)
  - All input parameters and context
  - All error messages from each retry attempt
  - Timestamps of each retry attempt
  - Final failure reason
**And** a "dlq.added" event is logged

**Given** the DLQ has entries
**When** I run `ao dlq`
**Then** all DLQ entries are displayed in a table:
  - Entry ID
  - Operation type
  - Failed date
  - Reason (truncated to fit)
  - Retry count
**And** the most recent entries are shown first

**Given** I want to view a DLQ entry details
**When** I run `ao dlq --entry <entry-id>`
**Then** full details are displayed:
  - All input parameters
  - Complete error history
  - Suggested resolution steps
**And** action options are shown:
  - "[R]etry now"
  - "[D]iscard (remove from DLQ)"
  - "[I]nvestigate (open error context)"

**Given** I choose to retry a DLQ entry
**When** I run `ao dlq --retry <entry-id>`
**Then** the operation is re-executed immediately
**And** if successful:
  - The entry is removed from DLQ
  - "dlq.resolved" event is logged
  - Success message is displayed
**And** if it fails again:
  - The entry remains in DLQ
  - Retry count is incremented
  - New error is logged

**Given** I choose to discard a DLQ entry
**When** I run `ao dlq --discard <entry-id>`
**Then** the entry is removed from DLQ
**And** "dlq.discarded" event is logged
**And** confirmation is displayed: "Entry <entry-id> discarded"

**Given** the DLQ grows large (>100 entries)
**When** the threshold is crossed
**Then** a warning notification is sent: "DLQ has 127 entries - review needed"
**And** the health panel shows DLQ count in red
**And** `ao health` includes: "DLQ: 127 entries"

**Given** I want to bulk retry DLQ entries
**When** I run `ao dlq --retry-all --type sync`
**Then** all sync-type DLQ entries are retried in order
**And** results are summarized: "Retried 15 entries: 12 succeeded, 3 failed"
**And** failed entries remain in DLQ with updated retry counts

**Given** I want to export DLQ for analysis
**When** I run `ao dlq --export dlq-export.json`
**Then** all DLQ entries are exported to JSON file
**And** the export includes all context and error history
**And** the file can be analyzed externally or imported into another instance

**Requirements Fulfilled:** AR5, FR38

---
### Story 4.6: Event Bus Backlog Recovery

As a Developer,
I want the system to automatically drain queued events after the event bus recovers,
So that no events are lost during service interruptions.

**Acceptance Criteria:**

**Given** the event bus was unavailable and 50 events were queued
**When** the event bus reconnects
**Then** the system automatically begins draining the queue
**And** publishes queued events in order (FIFO)
**And** publishes "drain.started" event with count
**And** displays progress: "Draining 50 queued events..."

**Given** the queue is being drained
**When** events are published
**Then** the system publishes at a controlled rate (max 100 events/sec)
**And** shows progress updates every 10 events: "Drained 20/50 events..."
**And** if an event fails to publish, it's retried once
**And** failed events after retry are moved to DLQ

**Given** all queued events are drained successfully
**When** the drain completes
**Then** the system publishes "drain.completed" event
**And** displays: "Drained 50 queued events in 0.8s"
**And** exits degraded mode for event bus
**And** normal event publishing resumes

**Given** the queue drain is interrupted (event bus fails again)
**When** the interruption occurs
**Then** drain progress is saved (e.g., "drained 35/50")
**And** the system re-enters degraded mode
**And** remaining events stay in queue
**And** when event bus recovers, drain resumes from saved progress

**Given** a large backlog exists (1000+ events)
**When** draining begins
**Then** the system displays: "Draining 1,247 queued events (estimated 13s)"
**And** the drain rate is adjusted to prevent event bus overload
**And** progress updates every 100 events
**And** the drain completes within 30 seconds (NFR-SC6)

**Given** I want to check drain status
**When** I run `ao drain --status`
**Then** the system displays:
  - Drain state (idle, draining, interrupted)
  - Queued event count
  - Drained count
  - Estimated time remaining
**And** if not draining, shows last drain completion time

**Given** I want to manually trigger a drain
**When** I run `ao drain --now`
**Then** if events are queued and event bus is available
**And** the drain begins immediately
**And** displays progress as events are published
**And** if no events are queued, shows: "No queued events to drain"

**Given** the system crashes while draining
**When** the system restarts
**Then** the queue state is recovered from disk (persistent queue)
**And** drain resumes automatically from last saved position
**And** events published before crash are not republished (idempotency)

**Requirements Fulfilled:** FR36, NFR-SC6

---
### Story 4.7: Metadata Corruption Detection and Recovery

As a Developer,
I want the system to detect corrupted metadata files and recover from backups,
So that data corruption doesn't cause cascading failures.

**Acceptance Criteria:**

**Given** sprint-status.yaml becomes corrupted (invalid YAML, missing fields)
**When** the system attempts to read the file
**Then** the corruption is detected during YAML parsing
**And** the error is logged with full context
**And** "Corrupted sprint-status.yaml detected" alert is displayed
**And** the system checks for backup files:
  - sprint-status.yaml.backup (most recent)
  - sprint-status.yaml.backup.{N} (rotated backups)

**Given** a valid backup file exists
**When** corruption is detected
**Then** the system prompts: "Restore from backup? [y/N]"
**And** if confirmed:
  - The corrupted file is renamed to sprint-status.yaml.corrupted.{timestamp}
  - The backup is copied to sprint-status.yaml
  - "Restored from backup" event is logged
  - The system continues with restored data
**And** if not confirmed:
  - The system enters "corrupted state" mode
  - Only read-only operations are allowed
  - Admin is prompted to manually restore

**Given** no backup file exists
**When** corruption is detected
**Then** the system displays: "No backup available. Manual restore required."
**And** shows the corruption details (parse error, line number)
**And** provides options:
  - "[E]dit manually - Open file in editor"
  - "[R]estore from JSONL - Reconstruct from event log"
  - "[Q]uit - Exit without changes"

**Given** I choose to reconstruct from JSONL
**When** the reconstruction is selected
**Then** the system reads events.jsonl in reverse order
**And** rebuilds sprint-status.yaml from the most recent events
**And** validates the reconstructed file
**And** if valid:
  - Saves the reconstructed file
  - Creates a backup before overwriting corrupted version
  - "Reconstructed from event log" event is logged
**And** if invalid:
  - Shows reconstruction errors
  - Offers manual edit option

**Given** the system is in normal operation
**When** sprint-status.yaml is updated successfully
**Then** a backup is automatically created:
  - sprint-status.yaml.backup is rotated to .backup.1
  - sprint-status.yaml.backup.1 is rotated to .backup.2
  - (up to 5 rotated backups: .backup.1 through .backup.5)
  - The current file is copied to sprint-status.yaml.backup
**And** backup rotation keeps the last 5 versions

**Given** I want to manually verify file integrity
**When** I run `ao verify --metadata`
**Then** the system validates:
  - YAML syntax is valid
  - Required fields exist (stories, metadata)
  - Version stamp is present
  - Story IDs are unique
  - Dependencies reference valid stories
**And** displays: "✅ Metadata valid" or lists issues found

**Given** multiple metadata files are corrupted
**When** verification is run
**Then** all metadata files are checked:
  - sprint-status.yaml
  - agent-orchestrator.yaml
  - events.jsonl (for corruption)
**And** a report is generated showing status of each file
**And** recovery options are provided for each corrupted file

**Requirements Fulfilled:** FR40, NFR-R10, NFR-I5

---
### Story 4.8: Health Check Configuration

As a DevOps Engineer,
I want to configure health check thresholds and alert rules,
So that the system monitors according to my environment's requirements.

**Acceptance Criteria:**

**Given** I want to configure health checks
**When** I edit agent-orchestrator.yaml and add a health section:
```yaml
health:
  checks:
    eventBus:
      enabled: true
      interval: 30s
      timeout: 5s
      failureThreshold: 3  # alert after 3 consecutive failures
    bmadSync:
      enabled: true
      interval: 60s
      timeout: 10s
      maxLatency: 5000ms  # alert if sync takes >5s
    agents:
      enabled: true
      interval: 30s
      blockedThreshold: 3  # alert if >3 agents blocked
      idleThreshold: 10  # alert if >10 agents idle
  alerts:
    desktop:
      enabled: true
      priority: critical  # only critical alerts
    slack:
      enabled: false
    webhook:
      enabled: false
```
**Then** the system applies the configuration on reload
**And** validates all thresholds at startup
**And** rejects invalid values (negative numbers, impossible combinations)

**Given** health checks are configured
**When** a check interval elapses
**Then** the system runs the configured health checks
**And** each check produces:
  - Status: "healthy" | "degraded" | "unhealthy"
  - Value: current measurement
  - Threshold: configured alert threshold
  - Message: human-readable status
**And** results are logged to the event audit trail

**Given** the event bus health check fails 3 times
**When** the failure threshold is crossed
**Then** an "health.unhealthy" event is published
**And** a desktop notification is sent: "Health alert: Event bus unhealthy (3 consecutive failures)"
**And** the health panel shows the event bus status as 🔴 unhealthy
**And** the alert persists until the check passes again

**Given** sync latency exceeds the configured threshold
**When** the bmadSync check runs
**Then** the check status is "degraded" (not "unhealthy")
**And** a warning is logged: "BMAD sync latency: 8.2s (threshold: 5s)"
**And** the health panel shows sync latency in yellow

**Given** I want to check health manually
**When** I run `ao health`
**Then** a health report is displayed:
```
Health Status: Degraded

Event Bus:     ✅ Healthy (12ms latency)
BMAD Sync:     ⚠️  Degraded (8.2s latency, threshold: 5s)
Active Agents: ✅ Healthy (8 active, 0 blocked)
System Uptime: ✅ Healthy (99.2%, last 24h)

Last check: 2026-03-05 14:32:15
Next check: in 28 seconds
```

**Given** I want to trigger an immediate health check
**When** I run `ao health --check-now`
**Then** all health checks run immediately
**And** results are displayed
**And** the check interval timer resets

**Given** I want to view health history
**When** I run `ao health --history --last 24h`
**Then** a historical health report is displayed:
  - Check results over time
  - Periods of degraded/unhealthy status
  - Alert history
**And** the data is available as JSON: `ao health --history --json`

**Given** health is degraded for >30 minutes
**When** the threshold is crossed
**Then** an escalation alert is sent: "Health degraded for 30+ minutes - investigate"
**And** the alert includes details of which checks are failing
**And** the alert repeats every 30 minutes until resolved

**Requirements Fulfilled:** FR39, NFR-R1

---

## Epic 5: Multi-Agent Conflict Resolution

**Epic Goal:** Detect duplicate story assignments; resolve conflicts by reassignment; prevent new assignments during conflicts; view resolution history

**FRs Covered:** FR41-FR44
**Phase:** 2 (After CLI MVP is stable)

---

### Story 5.1: Conflict Detection Engine

As a Developer,
I want the system to automatically detect when multiple agents are assigned to the same story,
So that conflicts are identified before they cause issues.

**Acceptance Criteria:**

**Given** STORY-001 is assigned to agent "ao-story-001"
**When** I attempt to spawn another agent for STORY-001
**Then** the conflict detection engine identifies the duplicate assignment
**And** a "conflict.detected" event is published
**And** the system displays: "⚠️ Conflict detected: STORY-001 is already assigned to ao-story-001"
**And** the spawn operation is blocked until I confirm

**Given** the conflict is detected
**When** the conflict event is published
**Then** the event includes:
  - Conflict ID (UUID)
  - Story ID
  - Existing agent ID and assignment timestamp
  - Conflicting agent ID and attempted timestamp
  - Conflict type (duplicate_assignment)
  - Priority score of each agent (based on story progress, time spent)

**Given** an agent completes its story and is reassigned
**When** the new assignment creates a conflict
**Then** the conflict is detected before the reassignment completes
**And** the agent remains with its previous assignment
**And** an alert is shown: "Cannot reassign: STORY-002 is assigned to ao-story-003"

**Given** concurrent spawn operations occur for the same story
**When** two agents are spawned simultaneously
**Then** the first spawn to acquire the lock succeeds
**And** the second spawn detects the conflict
**And** the conflict is logged with both agents' timestamps
**And** manual resolution is required

**Given** I want to check for existing conflicts
**When** I run `ao conflicts`
**Then** all active conflicts are displayed:
  - Conflict ID
  - Story ID
  - Conflicting agents
  - Conflict duration
  - Recommended resolution
**And** the output is sorted by severity (priority impact)

**Given** a conflict exists
**When** I view the fleet monitoring dashboard
**Then** conflicting stories are highlighted with a special indicator
**And** the agent cards show "⚠️ Conflict" badge
**And** clicking the badge opens the conflict resolution modal

**Given** the system starts and existing conflicts exist
**When** the agent registry is loaded
**Then** conflicts are detected during startup validation
**And** a startup summary is shown: "2 conflicts detected - run 'ao conflicts' for details"
**And** the conflicts are logged for tracking

**Requirements Fulfilled:** FR41

---
### Story 5.2: Conflict Resolution Service

As a Developer,
I want the system to automatically resolve conflicts by reassigning agents to available stories,
So that all agents remain productive without manual intervention.

**Acceptance Criteria:**

**Given** a conflict is detected (two agents on STORY-001)
**When** the conflict resolution service runs
**Then** the system evaluates both agents using priority scoring:
  - Agent with lower priority score is marked for reassignment
  - Priority factors: story progress (% complete), time spent, agent type
**And** the higher-priority agent keeps the story
**And** the lower-priority agent is queued for reassignment

**Given** agent "ao-story-001" is marked for reassignment
**When** the resolution service searches for available stories
**Then** it queries the story queue for unassigned stories
**And** prioritizes stories by:
  - Stories with no dependencies (ready to start)
  - Stories with highest priority value
  - Stories blocked by the just-completed story
**And** assigns the agent to the best available story

**Given** an available story is found
**When** the agent is reassigned
**Then** the reassignment completes:
  - Agent registry is updated with new story
  - "conflict.resolved" event is logged
  - "agent.reassigned" event is published
  - Notification: "ao-story-001 reassigned from STORY-001 to STORY-005"
**And** the agent receives the new story context

**Given** no available stories exist when reassigning
**When** the story queue is empty
**Then** the agent is marked as "idle" (no story assigned)
**And** the agent is monitored for auto-assignment when stories become available
**And** a notification is sent: "ao-story-001 is idle (no stories available)"

**Given** I want to trigger manual conflict resolution
**When** I run `ao conflicts --resolve <conflict-id>`
**Then** the system evaluates the conflict
**And** shows recommended resolution with priority scores
**And** prompts for confirmation: "Reassign ao-story-002 to STORY-005? [y/N]"
**And** if confirmed, executes the reassignment

**Given** I want to specify which agent keeps the story
**When** I run `ao conflicts --resolve <conflict-id> --keep ao-story-001`
**Then** the specified agent retains the story
**And** the other agent is queued for reassignment
**And** the resolution is logged with my decision

**Given** I want to reject auto-resolution
**When** I run `ao conflicts --resolve <conflict-id> --manual`
**Then** the system does not auto-resolve
**And** the conflict remains open
**And** I must manually resolve via `ao assign` commands
**And** the manual resolution is logged

**Given** auto-resolution is enabled in config
**When** conflicts are detected
**Then** the system automatically resolves without confirmation
**And** notifications are sent for awareness
**And** all resolutions are logged to audit trail

**Requirements Fulfilled:** FR42

---
### Story 5.3: Conflict Prevention UI

As a Developer,
I want new agent assignments to be blocked when conflicts are detected,
So that conflicts don't accidentally occur during normal operations.

**Acceptance Criteria:**

**Given** an active conflict exists (STORY-001 has two agents)
**When** I attempt to spawn a third agent for STORY-001
**Then** the spawn operation is blocked immediately
**And** the system displays:
  ```
  ⛔ Conflict Prevention: Cannot spawn agent for STORY-001
  
  Existing assignments:
    - ao-story-001 (assigned 10m ago, 45% complete)
    - ao-story-002 (assigned 5m ago, 20% complete)
  
  Active conflict: conflict-abc-123
  
  Options:
    [R]esolve conflict first
    [V]iew conflict details
    [S]pawn anyway (requires --force flag)
  ```

**Given** a conflict exists
**When** I run `ao spawn --story STORY-001 --force`
**Then** the spawn proceeds despite the conflict
**And** a warning is logged: "Forced spawn despite conflict-abc-123"
**And** the conflict is updated to include the new agent
**And** a "conflict.aggravated" event is published

**Given** I'm viewing the dashboard
**When** I click the "Spawn Agent" button for a story with a conflict
**Then** the spawn modal shows a conflict warning banner
**And** the "Spawn" button is disabled with tooltip: "Resolve conflict first"
**And** a "View Conflict" link opens the conflict detail modal
**And** the conflict status is visible in the story card

**Given** I'm using the CLI to assign stories
**When** I run `ao assign STORY-001 ao-story-003` (conflict exists)
**Then** the assignment is blocked
**And** displays: "Cannot assign: STORY-001 has active conflict conflict-abc-123"
**And** shows the conflicting agents
**And** suggests: "Run 'ao conflicts --resolve conflict-abc-123' to resolve first"

**Given** auto-resolution is enabled
**When** I attempt an assignment that would create a conflict
**Then** the system auto-resolves the existing conflict first
**And** then proceeds with my new assignment
**And** displays: "Auto-resolved conflict-abc-123, assigning ao-story-004 to STORY-002"

**Given** the conflict resolution is in progress
**When** I attempt to spawn during resolution
**Then** the spawn is queued with message: "Queued spawn for STORY-001 (resolution in progress)"
**And** spawns automatically when resolution completes
**And** I can cancel the queued spawn with Ctrl+C

**Given** I want to bypass prevention for testing
**When** I set agent.conflictPrevention to false in config
**Then** assignments are not blocked
**And** warnings are still displayed
**And** conflicts can be created freely (useful for testing scenarios)

**Given** multiple conflicts exist
**When** I run `ao spawn` for any story
**Then** if the target story has no conflicts, spawn proceeds normally
**And** conflicts on other stories don't affect this spawn
**And** only conflicts on the target story block the operation

**Requirements Fulfilled:** FR43

---
### Story 5.4: Conflict History Dashboard

As a Tech Lead,
I want to view the history of conflict detection and resolution decisions,
So that I can understand patterns and improve the system.

**Acceptance Criteria:**

**Given** I navigate to the Conflicts page in the dashboard
**When** the page loads
**Then** a conflict history is displayed showing:
  - Active conflicts (highlighted at top)
  - Resolved conflicts (chronological, newest first)
  - Conflict statistics (total count, resolution rate, avg resolution time)
**And** the page loads within 2 seconds (NFR-P3)

**Given** I view the conflict history
**When** I look at a resolved conflict entry
**Then** it displays:
  - Conflict ID
  - Story ID
  - Conflicting agents (with links to agent details)
  - Detection timestamp
  - Resolution timestamp
  - Resolution duration
  - Resolution type (auto_reassign, manual, force_spawn)
  - Resolution decision (which agent kept the story, if reassigned)
  - Who/what resolved it (user "alice", auto-resolution)

**Given** I want to filter conflicts
**When** I use the filter controls
**Then** I can filter by:
  - Status (active, resolved)
  - Resolution type (auto, manual, forced)
  - Date range
  - Story ID
  - Agent ID
**And** results update in real-time as filters change

**Given** I click on a conflict entry
**When** the conflict detail modal opens
**Then** the full conflict timeline is displayed:
  - Initial detection event
  - All related agent assignment changes
  - Resolution decision with reasoning
  - Post-resolution agent status
  - Related events (reassignments, notifications)
**And** a "Download JSON" button exports full conflict data

**Given** I want to see conflict patterns
**When** I view the conflict statistics panel
**Then** the system displays:
  - Total conflicts: "47 (12 active, 35 resolved)"
  - Resolution rate: "95.7% auto-resolved"
  - Avg resolution time: "2.3 seconds"
  - Most conflicted stories: "STORY-001 (5 times), STORY-007 (3 times)"
  - Most involved agents: "ao-story-001 (8 conflicts), ao-story-003 (5 conflicts)"
  - Common causes: "Concurrent spawns: 60%, Manual override: 30%, System bug: 10%"

**Given** I want to export conflict history
**When** I click "Export Conflicts"
**Then** the system generates a CSV report with:
  - All conflict records with full details
  - Applied filters
  - Export timestamp
**And** the file downloads with name: "conflicts-2026-03-05.csv"

**Given** I run `ao conflicts --history --last 7d`
**When** the CLI command executes
**Then** a conflict history table is displayed:
  ```
  Conflict ID   | Story     | Resolved | Type      | Duration | Resolver
  --------------|-----------|----------|-----------|----------|----------
  conflict-abc   | STORY-001 | ✅ Yes   | auto      | 2.1s     | system
  conflict-def   | STORY-005 | ✅ Yes   | manual    | 5m 30s   | alice
  conflict-ghi   | STORY-002 | ❌ No    | -         | 10m 2s   | -
  ```
**And** the output is color-coded and formatted for terminal display

**Given** a conflict was resolved incorrectly
**When** I want to analyze the decision
**Then** the conflict detail shows:
  - Priority scores for each agent at time of resolution
  - Available stories considered for reassignment
  - Why the specific resolution was chosen
  - Option to "Revert resolution" and re-resolve manually

**Given** I want to search for a specific conflict
**When** I use the search box
**Then** I can search by conflict ID, story ID, or agent ID
**And** results highlight matching text
**And** clicking a result jumps to that conflict in the timeline

**Requirements Fulfilled:** FR44, NFR-P3

---

## Epic 6: Plugin & Workflow Extensibility

**Epic Goal:** Install custom workflow plugins; define trigger conditions; plugin API with type definitions; community plugin registry

**FRs Covered:** FR45-FR50
**Phase:** 3 (After core system is stable)

---

### Story 6.1: Plugin System Core

As a Developer,
I want the system to load, validate, and manage plugins at startup,
So that I can extend functionality without modifying core code.

**Acceptance Criteria:**

**Given** the system starts up
**When** plugin initialization occurs
**Then** the system scans the plugins directory for installed plugins
**And** loads each plugin's manifest file (plugin.yaml)
**And** validates the manifest contains required fields:
  - name (unique identifier)
  - version (semver)
  - description
  - main (entry point file)
  - apiVersion (compatible agent-orchestrator API version)
  - permissions (required capabilities: runtime, tracker, etc.)
**And** plugins load within 2 seconds total (NFR-I1)

**Given** a plugin has invalid manifest or incompatible API version
**When** validation fails
**Then** the plugin is NOT loaded
**And** an error is logged with validation details
**And** the system continues without the plugin (NFR-I2)
**And** a warning is displayed: "Plugin 'my-plugin' failed to load: incompatible API version 2.0 (requires 1.x)"

**Given** a plugin throws an error during initialization
**When** the error is caught
**Then** the plugin is marked as "failed"
**And** the error is logged with full context
**And** core system functionality is not affected (isolation boundaries)
**And** other plugins continue to load normally

**Given** plugins are loaded successfully
**When** I run `ao plugins`
**Then** a table is displayed showing:
  - Plugin name
  - Version
  - Status (✅ loaded, ❌ failed, ⚠️ warning)
  - Description
**And** loaded plugins count is shown: "3 plugins loaded"

**Given** a plugin requests runtime permission
**When** the plugin manifest declares `permissions: ["runtime"]`
**Then** the system grants access to the Runtime plugin interface
**And** the plugin can spawn/destroy agents
**And** access is logged: "Plugin 'auto-spawner' granted runtime permission"

**Given** a plugin attempts an operation beyond its permissions
**When** the permission check fails
**Then** a PermissionError is thrown
**And** the error is logged with the plugin name and attempted operation
**And** the plugin handles the error gracefully

**Given** I want to reload plugins without restarting
**When** I run `ao plugins --reload`
**Then** all plugins are unloaded and reloaded
**And** validation runs again
**And** reload results are displayed
**And** the system continues operating during reload (hot reload)

**Given** a plugin needs to be disabled temporarily
**When** I run `ao plugins --disable my-plugin`
**Then** the plugin is marked as disabled
**And** the plugin is unloaded from memory
**And** disabled plugins persist across restarts
**And** `ao plugins --enable my-plugin` re-enables the plugin

**Requirements Fulfilled:** FR45, FR47, NFR-I1, NFR-I2

---
### Story 6.2: Plugin API with Type Definitions

As a Plugin Developer,
I want comprehensive TypeScript type definitions and API documentation,
So that I can develop plugins with compile-time validation and IntelliSense.

**Acceptance Criteria:**

**Given** I install the agent-orchestrator SDK
**When** I import types in my plugin
```typescript
import type {
  Plugin,
  PluginContext,
  Story,
  Agent,
  Event,
  Trigger,
  EventHandler
} from "@composio/ao-plugin-api";
```
**Then** all types are available for compile-time checking (NFR-I3)
**And** TypeScript provides IntelliSense for all API methods
**And** type mismatches are caught at compile time, not runtime

**Given** I create a plugin
**When** I implement the Plugin interface
**Then** my plugin must export:
  - `manifest: PluginManifest` - Plugin metadata
  - `create(context: PluginContext): Plugin` - Plugin factory function
**And** TypeScript validates the export matches the Plugin interface
**And** the Plugin interface requires:
  - `name: string`
  - `version: string`
  - `init(): Promise<void>`
  - `onEvent(event: Event): Promise<void>` (optional)
  - `shutdown(): Promise<void>`

**Given** I want to handle events
**When** I implement an event handler
**Then** the Event type provides:
  - `id: string`
  - `type: string`
  - `timestamp: Date`
  - `data: Record<string, unknown>`
**And** TypeScript narrows event data based on event type
**And** I can access story-specific fields for "story.completed" events

**Given** I need plugin context
**When** my plugin receives a PluginContext
**Then** the context provides:
  - `logger: Logger` - Structured logging
  - `config: Config` - Access to agent-orchestrator.yaml
  - `events: EventEmitter` - Subscribe/publish events
  - `state: StateManager` - Read/write story state
  - `agents: AgentManager` - Spawn/query agents
**And** each interface is fully typed with JSDoc comments

**Given** I want to read API documentation
**When** I access the plugin documentation
**Then** comprehensive docs are available at:
  - JSDoc comments in type definitions (hover in IDE)
  - /docs/plugins.md in the repository
  - Online API reference (when hosted)
**And** docs include:
  - All interfaces and their methods
  - Usage examples for common operations
  - Best practices and patterns
  - Migration guides between API versions

**Given** I want to validate my plugin types
**When** I run `npx tsc --noEmit` in my plugin project
**Then** TypeScript type-checks my plugin against the API
**And** any type errors are reported with clear messages
**And** I can fix errors before runtime

**Given** a new API version is released
**When** I update my plugin's apiVersion in manifest
**Then** TypeScript shows deprecation warnings for changed APIs
**And** migration documentation explains breaking changes
**And** the system validates plugin compatibility at load time

**Requirements Fulfilled:** FR49, NFR-I3

---
### Story 6.3: Custom Trigger Conditions

As a Developer,
I want to define custom trigger conditions based on story attributes,
So that plugins can execute workflows automatically when specific conditions are met.

**Acceptance Criteria:**

**Given** I'm developing a plugin
**When** I define a trigger in plugin.yaml
```yaml
triggers:
  - name: "auto-assign-high-priority"
    condition:
      story:
        priority: "high"
        status: "todo"
      time:
        hour: { start: 9, end: 17 }  # Business hours
    action: "autoAssignAgent"
```
**Then** the trigger is registered during plugin initialization
**And** the system evaluates the condition when stories change
**And** when the condition matches, the plugin's action is invoked

**Given** a story has priority="high" and status="todo"
**When** the story is created or updated during business hours
**Then** the trigger condition evaluates to true
**And** the plugin's `autoAssignAgent` action is called
**And** the story context is passed to the action
**And** the action result is logged

**Given** I want to trigger based on story tags
**When** I define a condition with tags:
```yaml
triggers:
  - name: "notify-on-security-story"
    condition:
      story:
        tags: ["security", "audit"]
    action: "sendSecurityNotification"
```
**Then** the trigger fires when a story has matching tags
**And** multiple tags use AND logic (all must match)
**And** I can use `tags: { any: ["security", "performance"] }` for OR logic

**Given** I want to trigger based on custom attributes
**When** I define:
```yaml
triggers:
  - name: "complex-story-alert"
    condition:
      story:
        points: { gte: 8 }  # Greater than or equal
        dependencies: { gte: 3 }  # 3+ dependencies
        labels: { contains: "frontend" }
    action: "alertComplexStory"
```
**Then** the condition supports operators:
  - `eq` (equals, default)
  - `ne` (not equals)
  - `gte` (greater than or equal)
  - `gt` (greater than)
  - `lte` (less than or equal)
  - `lt` (less than)
  - `contains` (array contains value)
  - `matches` (regex pattern)

**Given** I want to trigger on events
**When** I define:
```yaml
triggers:
  - name: "cleanup-after-completion"
    condition:
      event:
        type: "story.completed"
    action: "runCleanupTasks"
```
**Then** the trigger fires when the specified event occurs
**And** the event data is available to the action

**Given** I want to combine multiple conditions
**When** I define:
```yaml
triggers:
  - name: "complex-trigger"
    condition:
      and:
        - story: { status: "blocked" }
        - time: { weekday: "monday" }
        - event: { type: "agent.idle" }
    action: "escalateBlockedStory"
```
**Then** I can combine conditions with AND/OR/NOT logic
**And** all conditions must be true for AND triggers
**And** any condition can be true for OR triggers

**Given** a trigger fires repeatedly
**When** the action is invoked multiple times
**Then** I can configure `debounce: 300` to limit firing (once per 5 minutes)
**And** I can configure `once: true` to fire only once ever
**And** the trigger state is persisted across restarts

**Given** I want to list active triggers
**When** I run `ao triggers`
**Then** all registered triggers are displayed:
  - Trigger name
  - Plugin that registered it
  - Condition summary
  - Fire count (how many times triggered)
  - Last fired timestamp

**Requirements Fulfilled:** FR46

---
### Story 6.4: Custom Event Handlers for Workflow Automation

As a Plugin Developer,
I want to define custom event handlers that execute workflows based on triggers,
So that I can automate complex processes without modifying core code.

**Acceptance Criteria:**

**Given** I'm creating a workflow plugin
**When** I implement an event handler
```typescript
import { Plugin, PluginContext, Event } from "@composio/ao-plugin-api";

export function create(context: PluginContext): Plugin {
  return {
    name: "auto-assign",
    version: "1.0.0",
    
    async init() {
      // Subscribe to events
      context.events.subscribe("story.created", this.onStoryCreated);
      context.events.subscribe("story.completed", this.onStoryCompleted);
    },
    
    async onStoryCreated(event: Event) {
      const story = event.data.story;
      if (story.priority === "high") {
        // Auto-assign an agent to high-priority stories
        const agent = await context.agents.spawn({
          storyId: story.id,
          priority: 1
        });
        context.logger.info(`Auto-assigned agent ${agent.id} to high-priority story ${story.id}`);
      }
    },
    
    async onStoryCompleted(event: Event) {
      const story = event.data.story;
      // Find dependent stories and auto-assign them
      const dependents = await context.stories.findByDependency(story.id);
      for (const dep of dependents) {
        if (dep.status === "blocked") {
          await context.stories.update(dep.id, { status: "ready" });
          context.logger.info(`Unblocked story ${dep.id} (dependency ${story.id} completed)`);
        }
      }
    },
    
    async shutdown() {
      // Cleanup
    }
  };
}
```
**Then** the handler is automatically invoked when subscribed events occur
**And** the handler receives full event context
**And** the handler can use PluginContext APIs to perform actions

**Given** an event handler throws an error
**When** the error is caught
**Then** the error is logged with the plugin and handler name
**And** the event is marked as "failed" for this handler
**And** other handlers for the same event continue executing
**And** the error doesn't crash the plugin or core system

**Given** I want to chain multiple actions
**When** I define a workflow handler
```yaml
workflows:
  - name: "on-completion-cleanup"
    trigger:
      event: { type: "story.completed" }
    steps:
      - action: "updateBurndown"
      - action: "notifyTeam"
        params: { channel: "#dev-updates" }
      - action: "checkDependents"
      - action: "assignNextStory"
```
**Then** steps execute in sequence
**And** each step receives the result of the previous step
**And** if a step fails, subsequent steps can be configured to:
  - `continue: true` - execute anyway
  - `continue: false` - stop workflow (default)

**Given** I want async workflow execution
**When** I define a step with `async: true`
**Then** the action is queued and executed asynchronously
**And** the workflow continues without waiting for completion
**And** the async action result is logged when it completes

**Given** I want conditional workflow steps
**When** I define:
```yaml
steps:
  - action: "checkApproval"
  - action: "mergePR"
    if: { result: "checkApproval.approved" }
```
**Then** the step only executes if the condition is met
**And** I can reference previous step results in conditions

**Given** I want to retry failed workflow steps
**When** I define:
```yaml
steps:
  - action: "deployToStaging"
    retry: { maxAttempts: 3, backoff: "exponential" }
```
**Then** failed steps are retried with exponential backoff
**And** after max attempts, the workflow fails
**And** the failure is logged and can trigger alerts

**Given** I want to monitor workflow execution
**When** I run `ao workflows --history`
**Then** a table is displayed showing:
  - Workflow name
  - Trigger event
  - Status (running, completed, failed)
  - Start time
  - Duration
  - Current step (if running)

**Requirements Fulfilled:** FR48

---
### Story 6.5: Plugin Installation CLI

As a Developer,
I want to install, list, and uninstall plugins from the command line,
So that I can manage my plugins without manual file operations.

**Acceptance Criteria:**

**Given** I want to install a plugin from npm
**When** I run `ao plugin install @composio/ao-plugin-slack`
**Then** the system:
  - Downloads the plugin package from npm
  - Validates the plugin manifest
  - Checks API version compatibility
  - Installs to the plugins directory
  - Runs `ao plugin load` to activate the plugin
  - Displays: "Installed @composio/ao-plugin-slack v1.2.0"

**Given** the plugin requires additional permissions
**When** I install the plugin
**Then** the system displays:
  ```
  Plugin @composio/ao-plugin-slack requires permissions:
    - notifier: Send slack notifications
    - tracker: Read story data
  
  Grant permissions? [y/N]
  ```
**And** if I deny, installation is cancelled
**And** if I grant, permissions are saved to config

**Given** I want to install a plugin from a local path
**When** I run `ao plugin install ./my-custom-plugin`
**Then** the system installs from the local directory
**And** validates the plugin structure
**And** symlinks or copies the plugin to the plugins directory

**Given** I want to list installed plugins
**When** I run `ao plugin list`
**Then** a table is displayed:
  ```
  Plugin                        | Version | Status    | Permissions
  -----------------------------|---------|-----------|-------------------------
  @composio/ao-plugin-slack     | 1.2.0   | ✅ Loaded | notifier
  @composio/ao-plugin-github    | 0.9.0   | ❌ Failed | scm, tracker
  my-custom-plugin              | 1.0.0   | ⚠️  Disabled | runtime
  ```
**And** shows total count: "3 plugins installed (2 loaded, 1 disabled, 1 failed)"

**Given** I want to view plugin details
**When** I run `ao plugin info @composio/ao-plugin-slack`
**Then** detailed information is displayed:
  - Name and description
  - Version and author
  - API version requirement
  - Granted permissions
  - Registered triggers
  - Registered workflows
  - Installation date
  - Load status and error (if failed)

**Given** I want to uninstall a plugin
**When** I run `ao plugin uninstall @composio/ao-plugin-slack`
**Then** the system:
  - Unloads the plugin from memory
  - Removes the plugin from the plugins directory
  - Removes plugin configuration from agent-orchestrator.yaml
  - Displays: "Uninstalled @composio/ao-plugin-slack"
**And** prompts if other plugins depend on it: "⚠️ Plugin 'slack-notifier' depends on this plugin. Continue? [y/N]"

**Given** I want to disable a plugin temporarily
**When** I run `ao plugin disable @composio/ao-plugin-slack`
**Then** the plugin is unloaded
**And** marked as disabled in config
**And** doesn't load on restart
**And** `ao plugin enable @composio/ao-plugin-slack` re-enables it

**Given** I want to update a plugin
**When** I run `ao plugin update @composio/ao-plugin-slack`
**Then** the system:
  - Checks for updates on npm
  - Shows current and available versions
  - Prompts: "Update from 1.2.0 to 1.3.0? [y/N]"
  - If confirmed, downloads and installs the new version
  - Reloads the plugin
  - Displays: "Updated @composio/ao-plugin-slack to v1.3.0"

**Given** I want to search for available plugins
**When** I run `ao plugin search slack`
**Then** the system queries the community registry
**And** displays matching plugins:
  ```
  Plugin                        | Description                     | Downloads
  -----------------------------|---------------------------------|----------
  @composio/ao-plugin-slack     | Slack notifications for agents  | 1,234
  @org/slack-workflow-automation| Custom Slack workflows           | 567
  ```

**Requirements Fulfilled:** FR45

---
### Story 6.6: Community Plugin Registry

As a Developer,
I want to discover and share plugins through a community registry,
So that I can benefit from community contributions and contribute back.

**Acceptance Criteria:**

**Given** I want to browse available plugins
**When** I run `ao plugin registry`
**Then** the system opens the registry in a browser or displays a CLI view:
  ```
  Agent Orchestrator Plugin Registry
  ===================================
  
  Featured Plugins:
  ├── @composio/ao-plugin-slack (1.2.0)
  │   └── Slack notifications for agent events
  │       Downloads: 1,234 | Rating: ⭐ 4.8
  │
  ├── @composio/ao-plugin-github (0.9.0)
  │   └── GitHub PR integration for story completion
  │       Downloads: 987 | Rating: ⭐ 4.5
  │
  └── @team/auto-assign-bot (2.1.0)
      └── Auto-assign agents based on story priority
          Downloads: 654 | Rating: ⭐ 4.9
  
  Categories:
  [Notifications] [Workflows] [Integrations] [Monitoring] [Testing]
  ```
**And** plugins are sorted by downloads and rating

**Given** I want to search for plugins
**When** I run `ao plugin registry search "jira"`
**Then** matching plugins are displayed:
  - Plugin name and description
  - Version and author
  - Downloads and rating
  - Tags for filtering
**And** I can filter by category with `--category integration`

**Given** I want to view plugin details from the registry
**When** I run `ao plugin registry info @composio/ao-plugin-slack`
**Then** detailed plugin info is displayed:
  - Full description
  - Screenshots or demo video links
  - Documentation link
  - Repository link
  - Author and maintainer info
  - Version history
  - Dependencies and permissions
  - User reviews and ratings
  - Installation instructions

**Given** I want to publish my plugin to the registry
**When** I run `ao plugin publish ./my-plugin`
**Then** the system:
  - Validates the plugin package structure
  - Runs tests if present (`npm test`)
  - Checks documentation completeness
  - Prompts for registry authentication if needed
  - Uploads the plugin package to the registry
  - Displays: "Published my-plugin v1.0.0 to registry"

**Given** I want to publish a plugin for the first time
**When** I run `ao plugin publish ./my-plugin`
**Then** the system prompts:
  ```
  Publishing new plugin to registry:
  
  Plugin: my-plugin v1.0.0
  Description: Auto-assign agents based on story tags
  
  This will create a public registry entry.
  Continue? [y/N]
  
  Registry username: your-name
  Registry token: [input hidden]
  ```
**And** after authentication, the plugin is published

**Given** I want to update a published plugin
**When** I run `ao plugin publish ./my-plugin --update`
**Then** the system:
  - Checks if I'm the plugin maintainer
  - Validates the new version
  - Updates the registry entry
  - Preserves reviews and download counts
  - Displays: "Updated my-plugin to v1.1.0 in registry"

**Given** I want to report an issue with a plugin
**When** I run `ao plugin registry report @org/broken-plugin --issue "Doesn't work with v2.0"`
**Then** the system:
  - Opens an issue on the plugin's repository
  - Includes system context (agent-orchestrator version, OS, Node version)
  - Links the issue to the registry entry
  - Displays: "Issue reported: github.com/org/broken-plugin/issues/42"

**Given** I want to leave a review for a plugin
**When** I run `ao plugin registry review @composio/ao-plugin-slack --rating 5 --comment "Works great!"`
**Then** the review is submitted to the registry
**And** the plugin's rating is updated
**And** my review appears in the plugin details

**Given** I want to see plugin statistics
**When** I run `ao plugin registry stats @composio/ao-plugin-slack`
**Then** statistics are displayed:
  - Total downloads
  - Downloads over time (chart)
  - Average rating
  - Rating distribution
  - Active installs
  - Last updated

**Requirements Fulfilled:** FR50

---
