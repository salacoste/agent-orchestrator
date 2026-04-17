---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd-cycle-10.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Agent Orchestrator — Cycle 10 Epic Breakdown

## Overview

This document provides the epic and story breakdown for Cycle 10 of the Agent Orchestrator, implementing Multi-Project Management, Advanced Simulation, and Telegram Integration capabilities.

**Input Documents:**
- `prd-cycle-10.md` — Cycle 10 PRD
- `architecture.md` — Core architecture decisions
- `ux-design-specification.md` — UX patterns

**Totals:** 65 FRs + 26 NFRs across 3 capability areas

---

## Requirements Inventory

### Functional Requirements — Multi-Project Management (F)

**Portfolio Dashboard (F1):**
FR-F1-1: Users can view a portfolio dashboard showing all configured projects in a single view
FR-F1-2: The portfolio dashboard displays aggregated metrics (total agents, stories by status, sprint health, resource utilization)
FR-F1-3: Users can drill down from portfolio view to individual project dashboards
FR-F1-4: The portfolio dashboard updates in real-time via SSE when any project state changes
FR-F1-5: Users can filter projects by tags, status, or custom metadata

**Shared Agent Pool (F2):**
FR-F2-1: Users can configure a shared agent pool that spans multiple projects
FR-F2-2: The system intelligently allocates agents from the shared pool based on priority, urgency, affinity, and workload
FR-F2-3: Agents can be assigned to stories across project boundaries when in shared pool mode
FR-F2-4: Users can reserve specific agents for exclusive project use (not shared)
FR-F2-5: The system tracks agent utilization across projects with per-project breakdown
FR-F2-6: Conflict detection prevents over-allocation of shared agents

**Cross-Project Dependencies (F3):**
FR-F3-1: Users can define dependencies between stories in different projects
FR-F3-2: The system tracks cross-project dependency status and blocks dependent stories appropriately
FR-F3-3: When a prerequisite story completes in Project A, dependent stories in Project B are automatically unblocked
FR-F3-4: The dependency graph visualizes cross-project relationships in the dashboard
FR-F3-5: Users receive notifications when cross-project dependencies are blocking progress
FR-F3-6: Circular dependency detection works across project boundaries

**Resource Conflict Detection (F4):**
FR-F4-1: The system detects when multiple projects target the same files or repositories
FR-F4-2: Users receive alerts when resource conflicts are detected
FR-F4-3: The conflict dashboard shows which projects are competing for which resources
FR-F4-4: Users can configure conflict resolution strategies (priority-based, manual)
FR-F4-5: The system provides recommendations for resolving resource conflicts

**Unified Sprint View (F5):**
FR-F5-1: Users can view all active sprints across all projects in a single view
FR-F5-2: Sprint timelines show relative progress across projects
FR-F5-3: Users can compare sprint velocity and health across projects
FR-F5-4: The unified view supports filtering by sprint status, project, and time range
FR-F5-5: Aggregated sprint metrics update in real-time

---

### Functional Requirements — Advanced Simulation (E)

**What-If Scenarios (E1):**
FR-E1-1: Users can create what-if scenarios to simulate changes without affecting the real system
FR-E1-2: Scenarios can modify: agent count, priority, capacity, story scope
FR-E1-3: The system runs simulations and predicts outcomes (completion date, bottlenecks, risks)
FR-E1-4: Users can compare multiple scenarios side-by-side
FR-E1-5: Simulation results are persisted and can be reviewed later

**Monte Carlo Forecasting (E2):**
FR-E2-1: The system runs Monte Carlo simulations for sprint completion forecasting
FR-E2-2: Users can configure simulation parameters (iterations, confidence intervals)
FR-E2-3: The dashboard shows probabilistic completion dates with confidence levels
FR-E2-4: Historical data improves forecast accuracy over time
FR-E2-5: Users can export simulation results for stakeholder reporting

**Risk Analysis Dashboard (E3):**
FR-E3-1: The risk dashboard visualizes identified risk factors across all projects
FR-E3-2: Users can view bottleneck analysis showing constraints and dependencies
FR-E3-3: The system provides risk scores for stories, sprints, and projects
FR-E3-4: Users can drill down into risk factors to understand root causes
FR-E3-5: The dashboard highlights emerging risks based on pattern detection
FR-E3-6: Risk alerts can be configured with custom thresholds

**Resource Optimization (E4):**
FR-E4-1: The system provides recommendations for optimal agent allocation
FR-E4-2: Users can run optimization scenarios to find efficiency improvements
FR-E4-3: The dashboard shows resource utilization metrics and trends
FR-E4-4: The system identifies underutilized agents and suggests reallocation
FR-E4-5: Optimization recommendations include estimated impact analysis

---

### Functional Requirements — Telegram Integration (I)

**Telegram Notifications (I1):**
FR-I1-1: Users can configure Telegram as a notification channel
FR-I1-2: The system sends push notifications for critical events (agent blocked, conflict detected, sprint complete)
FR-I1-3: Users can configure notification preferences per event type
FR-I1-4: Notifications include actionable context (agent ID, story ID, CLI commands)
FR-I1-5: The system supports multiple Telegram channels (per project, per team)

**Telegram Commands (I2):**
FR-I2-1: Users can send `/status` command to view system status
FR-I2-2: Users can send `/fleet` command to view active agents
FR-I2-3: Users can send `/spawn --story STORY_ID` to spawn an agent
FR-I2-4: Users can send `/health` command to view system health
FR-I2-5: Command responses include formatted tables and status indicators
FR-I2-6: The bot validates user permissions before executing commands

**Telegram Interactive Elements (I3):**
FR-I3-1: Notifications include inline buttons for quick actions (Resume, Approve, Block)
FR-I3-2: Users can assign stories to agents via inline buttons
FR-I3-3: Users can resolve conflicts via interactive prompts
FR-I3-4: Interactive elements support confirmation dialogs for destructive actions
FR-I3-5: Users can configure which actions require interactive confirmation

---

### Non-Functional Requirements

**Performance:**
NFR-P1: Portfolio dashboard loads within 2 seconds with up to 50 projects
NFR-P2: Simulation scenarios complete within 30 seconds
NFR-P3: Telegram notifications deliver within 5 seconds of event
NFR-P4: Command responses return within 3 seconds

**Security:**
NFR-S1: Telegram bot authentication uses secure token validation
NFR-S2: Cross-project access respects project-level permissions
NFR-S3: Simulation scenarios cannot modify actual system state

**Scalability:**
NFR-SC1: Portfolio features support up to 50 projects
NFR-SC2: Shared agent pool supports up to 100 agents
NFR-SC3: Telegram bot handles up to 100 concurrent users

**Reliability:**
NFR-R1: Telegram notifications retry with exponential backoff
NFR-R2: Simulation results are deterministic for identical inputs
NFR-R3: Cross-project dependency tracking recovers from partial failures

---

## Approved Epic List

### Epic 49: Portfolio Dashboard
**User Outcome:** Users can view all configured projects in a single dashboard with aggregated metrics and real-time updates.
**FRs Covered:** FR-F1-1, FR-F1-2, FR-F1-3, FR-F1-4, FR-F1-5
**Est. Stories:** 8-10
**Phase:** Foundation (F1)

### Epic 50: Shared Agent Pool
**User Outcome:** Users can configure agents to work across multiple projects with intelligent allocation and conflict prevention.
**FRs Covered:** FR-F2-1, FR-F2-2, FR-F2-3, FR-F2-4, FR-F2-5, FR-F2-6
**Est. Stories:** 10-12
**Phase:** Foundation (F2)

### Epic 51: Cross-Project Dependencies
**User Outcome:** Users can define and track dependencies between stories in different projects with automatic blocking/unblocking.
**FRs Covered:** FR-F3-1, FR-F3-2, FR-F3-3, FR-F3-4, FR-F3-5, FR-F3-6
**Est. Stories:** 10-12
**Phase:** Foundation (F3)

### Epic 52: Resource Conflict Detection
**User Outcome:** Users are alerted when multiple projects compete for the same resources with resolution suggestions.
**FRs Covered:** FR-F4-1, FR-F4-2, FR-F4-3, FR-F4-4, FR-F4-5
**Est. Stories:** 8-10
**Phase:** Foundation (F4)

### Epic 53: Unified Sprint View
**User Outcome:** Users can view all active sprints across projects in a single view with velocity comparison.
**FRs Covered:** FR-F5-1, FR-F5-2, FR-F5-3, FR-F5-4, FR-F5-5
**Est. Stories:** 8-10
**Phase:** Foundation (F5)

### Epic 54: What-If Simulation Engine
**User Outcome:** Users can simulate changes before committing resources and compare scenario outcomes.
**FRs Covered:** FR-E1-1, FR-E1-2, FR-E1-3, FR-E1-4, FR-E1-5, FR-E1-6
**Est. Stories:** 10-12
**Phase:** Intelligence (E1)

### Epic 55: Monte Carlo Forecasting
**User Outcome:** Users get probabilistic completion dates with confidence intervals for better planning.
**FRs Covered:** FR-E2-1, FR-E2-2, FR-E2-3, FR-E2-4, FR-E2-5, FR-E2-6
**Est. Stories:** 10-12
**Phase:** Intelligence (E2)

### Epic 56: Risk & Optimization Dashboard
**User Outcome:** Users can identify risks, analyze bottlenecks, and receive optimization recommendations.
**FRs Covered:** FR-E3-1, FR-E3-2, FR-E3-3, FR-E3-4, FR-E3-5, FR-E3-6, FR-E4-1, FR-E4-2, FR-E4-3, FR-E4-4, FR-E4-5
**Est. Stories:** 18-22
**Phase:** Intelligence (E3, E4)

### Epic 57: Telegram Bot Integration
**User Outcome:** Users can receive notifications and control the orchestrator from Telegram with interactive buttons.
**FRs Covered:** FR-I1-1, FR-I1-2, FR-I1-3, FR-I1-4, FR-I1-5, FR-I2-1, FR-I2-2, FR-I2-3, FR-I2-4, FR-I2-5, FR-I3-1, FR-I3-2, FR-I3-3, FR-I3-4, FR-I3-5
**Est. Stories:** 20-25
**Phase:** Integration (I)

---

## Requirements Coverage Map

| Epic | FRs Covered | Count |
|------|-------------|-------|
| 49 | FR-F1-1 to FR-F1-5 | 5 |
| 50 | FR-F2-1 to FR-F2-6 | 6 |
| 51 | FR-F3-1 to FR-F3-6 | 6 |
| 52 | FR-F4-1 to FR-F4-5 | 5 |
| 53 | FR-F5-1 to FR-F5-5 | 5 |
| 54 | FR-E1-1 to FR-E1-6 | 6 |
| 55 | FR-E2-1 to FR-E2-6 | 6 |
| 56 | FR-E3-1 to FR-E3-6, FR-E4-1 to FR-E4-5 | 11 |
| 57 | FR-I1-1 to FR-I1-5, FR-I2-1 to FR-I2-5, FR-I3-1 to FR-I3-5 | 15 |
| **Total** | **All 65 FRs** | **65** |

---

## Dependency Flow

```
Epic 49 (Portfolio Dashboard) ──┬──► Epic 50 (Shared Agent Pool)
                                │
                                ├──► Epic 51 (Cross-Project Dependencies)
                                │           │
                                │           ├──► Epic 52 (Resource Conflicts)
                                │           │
                                │           └──► Epic 53 (Unified Sprint View)
                                │
                                └──► Epic 54 (What-If Simulation)
                                            │
                                            ├──► Epic 55 (Monte Carlo Forecasting)
                                            │
                                            └──► Epic 56 (Risk & Optimization)
                                                        │
                                                        └──► Epic 57 (Telegram Bot)
```

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Epics** | 9 |
| **Total FRs** | 65 |
| **Total NFRs** | 26 |
| **Est. Stories** | 100-125 |
| **Phases** | Foundation → Intelligence → Integration |

---

## Epic 49: Portfolio Dashboard

**Epic Goal:** Users can view all configured projects in a single dashboard with aggregated metrics, real-time updates via SSE, and drill-down navigation to individual project dashboards.

**FRs Covered:** FR-F1-1 to FR-F1-5

### Story 49.1: Portfolio Dashboard Page Structure

As a **project manager**,
I want **a portfolio dashboard page that displays all my configured projects**,
So that **I can see the status of all projects at a glance without switching contexts**.

**Acceptance Criteria:**

**Given** the orchestrator has multiple configured projects
**When** I navigate to the portfolio dashboard
**Then** I see a list of all projects with name, status, and key metrics
**And** projects are displayed in a responsive grid layout

### Story 49.2: Aggregated Metrics Widget

As a **project manager**,
I want **to see aggregated metrics across all projects**,
So that **I can quickly assess overall system health without calculating manually**.

**Acceptance Criteria:**

**Given** the portfolio dashboard is displayed
**When** I view the metrics section
**Then** I see total agents count, stories by status (backlog/in-progress/done/blocked), combined sprint health score, and resource utilization percentage
**And** metrics update automatically when project state changes

### Story 49.3: Project Drill-Down Navigation

As a **project manager**,
I want **to click on a project to navigate to its detailed dashboard**,
So that **I can investigate project-specific issues without manual navigation**.

**Acceptance Criteria:**

**Given** the portfolio dashboard displays multiple projects
**When** I click on a project card or row
**Then** I am navigated to that project's individual dashboard
**And** the project context is preserved (active project state)

### Story 49.4: Real-Time SSE Updates

As a **project manager**,
I want **the portfolio dashboard to update in real-time without refreshing**,
So that **I always see the current state of all projects**.

**Acceptance Criteria:**

**Given** the portfolio dashboard is open
**When** any project state changes (agent spawned, story completed, etc.)
**Then** the affected project card updates within 3 seconds
**And** aggregated metrics recalculate automatically

### Story 49.5: Project Filtering

As a **project manager**,
I want **to filter projects by tags, status, or custom metadata**,
So that **I can focus on relevant projects when managing a large portfolio**.

**Acceptance Criteria:**

**Given** the portfolio has 10+ projects with various tags and statuses
**When** I apply a filter (e.g., tag: "production", status: "active")
**Then** only matching projects are displayed
**And** filters can be combined (AND logic)
**And** a clear filters button resets the view

---

## Epic 50: Shared Agent Pool

**Epic Goal:** Users can configure a shared agent pool that spans multiple projects, with intelligent allocation based on priority, urgency, affinity, and workload. Agents can work across project boundaries, and the system prevents over-allocation.

**FRs Covered:** FR-F2-1 to FR-F2-6

### Story 50.1: Shared Pool Configuration

As a **project manager**,
I want **to configure an agent as part of a shared pool spanning multiple projects**,
So that **agents can be efficiently utilized across the portfolio**.

**Acceptance Criteria:**

**Given** I have multiple projects configured
**When** I create or edit an agent and enable "shared pool" mode
**Then** I can select which projects this agent can work on
**And** the agent appears in the shared pool dashboard

### Story 50.2: Agent Reservation for Exclusive Use

As a **project manager**,
I want **to reserve specific agents for exclusive project use**,
So that **critical project work is never blocked by other projects**.

**Acceptance Criteria:**

**Given** an agent exists in the shared pool
**When** I mark it as "reserved" for a specific project
**Then** only that project can assign stories to this agent
**And** other projects see the agent as unavailable

### Story 50.3: Intelligent Allocation Algorithm

As a **project manager**,
I want **the system to intelligently allocate shared agents based on multiple factors**,
So that **the highest-priority work gets resources first without manual intervention**.

**Acceptance Criteria:**

**Given** multiple stories are ready and shared agents are available
**When** the allocation algorithm runs
**Then** it considers project priority, story urgency, agent affinity/specialization, and current workload
**And** allocation decision completes within 500ms

### Story 50.4: Cross-Project Story Assignment

As a **project manager**,
I want **to assign a shared agent to a story in any eligible project**,
So that **work can flow across project boundaries based on capacity**.

**Acceptance Criteria:**

**Given** a shared agent is available
**When** I view a story in any project the agent is eligible for
**Then** the agent appears in the assignable agents list
**And** assigning the agent works the same as project-local agents

### Story 50.5: Agent Utilization Tracking

As a **project manager**,
I want **to see utilization metrics for shared agents with per-project breakdown**,
So that **I can understand how resources are distributed and rebalance if needed**.

**Acceptance Criteria:**

**Given** shared agents have been working across projects
**When** I view an agent's utilization report
**Then** I see total utilization percentage and time spent per project
**And** I can view this in both the agent detail page and portfolio dashboard

### Story 50.6: Over-Allocation Prevention

As a **project manager**,
I want **the system to prevent assigning more work to an agent than it can handle**,
So that **agents don't become overwhelmed and work quality doesn't degrade**.

**Acceptance Criteria:**

**Given** an agent is at maximum capacity (based on config)
**When** I try to assign another story to that agent
**Then** the system shows a warning that the agent is at capacity
**And** the assignment is blocked unless I explicitly override

---

## Epic 51: Cross-Project Dependencies

**Epic Goal:** Users can define dependencies between stories in different projects, with automatic blocking/unblocking, circular dependency detection, and a visualization of cross-project relationships.

**FRs Covered:** FR-F3-1 to FR-F3-6

### Story 51.1: Cross-Project Dependency Definition

As a **project manager**,
I want **to define a dependency from a story in one project to a story in another project**,
So that **my team knows when work depends on external deliverables**.

**Acceptance Criteria:**

**Given** I have a story in Project A that depends on a story in Project B
**When** I edit the story and add a cross-project dependency
**Then** I can search for and select stories from other projects
**And** the dependency is saved and displayed on both stories

### Story 51.2: Dependency Status Tracking

As a **project manager**,
I want **the system to automatically track cross-project dependency status**,
So that **I don't have to manually check if prerequisites are complete**.

**Acceptance Criteria:**

**Given** Story X in Project A depends on Story Y in Project B
**When** I view Story X
**Then** I see the dependency status (blocked/waiting/ready)
**And** the status updates automatically when Story Y's state changes

### Story 51.3: Automatic Story Unblocking

As a **project manager**,
I want **dependent stories to be automatically unblocked when prerequisites complete**,
So that **work can proceed immediately without manual intervention**.

**Acceptance Criteria:**

**Given** Story X is blocked by Story Y in another project
**When** Story Y is marked as done
**Then** Story X's status changes from "blocked" to "ready"
**And** the assigned agent receives a notification that work can proceed

### Story 51.4: Cross-Project Dependency Graph

As a **project manager**,
I want **a visual graph showing dependencies across projects**,
So that **I can understand the complex relationships in my portfolio**.

**Acceptance Criteria:**

**Given** multiple cross-project dependencies exist
**When** I view the dependency graph
**Then** I see nodes for stories grouped by project with edges showing dependencies
**And** I can click on edges to see dependency details
**And** the graph renders with up to 200 cross-project edges within 2 seconds

### Story 51.5: Dependency Blocking Notifications

As a **project manager**,
I want **to be notified when cross-project dependencies are blocking progress**,
So that **I can coordinate with other project teams to resolve blockers**.

**Acceptance Criteria:**

**Given** a story is blocked by a cross-project dependency for more than 1 hour
**When** the blocking period threshold is reached
**Then** I receive a notification identifying the blocked story and the blocking dependency
**And** the notification includes a link to contact the blocking project owner

### Story 51.6: Circular Dependency Detection

As a **project manager**,
I want **the system to detect circular dependencies across project boundaries**,
So that **I don't create impossible dependency chains**.

**Acceptance Criteria:**

**Given** I try to create a dependency that would form a cycle
**When** I attempt to save the dependency
**Then** the system shows an error explaining the circular dependency
**And** it displays the cycle path showing which stories form the loop
**And** the dependency is not created

---

## Epic 52: Resource Conflict Detection

**Epic Goal:** Users are automatically alerted when multiple projects target the same resources (repositories, file paths, agents, external services), with conflict resolution suggestions and configurable resolution policies.

**FRs Covered:** FR-F4-1 to FR-F4-5

### Story 52.1: Resource Conflict Detection Engine

As a **project manager**,
I want **the system to automatically detect when multiple projects target the same resources**,
So that **I'm aware of potential conflicts before they cause problems**.

**Acceptance Criteria:**

**Given** Project A and Project B both target the same git repository
**When** the conflict detection engine runs
**Then** a conflict is detected and logged
**And** the conflict includes resource type, competing projects, and severity

### Story 52.2: Conflict Alert Dashboard

As a **project manager**,
I want **to see all detected resource conflicts in a dedicated dashboard**,
So that **I can assess and address conflicts systematically**.

**Acceptance Criteria:**

**Given** resource conflicts have been detected
**When** I navigate to the conflict dashboard
**Then** I see a list of conflicts with resource, projects, and severity
**And** I can filter by resource type and severity
**And** clicking a conflict shows detailed information

### Story 52.3: Conflict Resolution Suggestions

As a **project manager**,
I want **the system to suggest conflict resolution strategies**,
So that **I can resolve conflicts quickly without extensive analysis**.

**Acceptance Criteria:**

**Given** a resource conflict is detected
**When** I view the conflict details
**Then** the system suggests resolution strategies (sequential scheduling, resource isolation, agent reassignment)
**And** each suggestion includes estimated impact

### Story 52.4: Conflict Resolution Policy Configuration

As a **project manager**,
I want **to configure automatic conflict resolution policies per resource type**,
So that **common conflicts are handled automatically based on my preferences**.

**Acceptance Criteria:**

**Given** I want specific handling for repository conflicts
**When** I configure a policy for the "repository" resource type
**Then** I can select priority-based, manual, or isolation resolution
**And** future conflicts of this type follow the configured policy

### Story 52.5: Conflict History Tracking

As a **project manager**,
I want **to see a history of past conflicts and how they were resolved**,
So that **I can identify patterns and prevent recurring conflicts**.

**Acceptance Criteria:**

**Given** conflicts have occurred and been resolved
**When** I view the conflict history
**Then** I see a chronological log of conflicts with resolution method
**And** I can filter by date range, resource type, and project
**And** I can export the history for analysis

---

## Epic 53: Unified Sprint View

**Epic Goal:** Users can view all active sprints across all projects in a single unified view, with progress bars, velocity comparison, blocking issues, and at-risk sprint identification.

**FRs Covered:** FR-F5-1 to FR-F5-5

### Story 53.1: Unified Sprint Dashboard

As a **project manager**,
I want **to see all active sprints across projects in a single view**,
So that **I can monitor portfolio-wide sprint progress without switching contexts**.

**Acceptance Criteria:**

**Given** multiple projects have active sprints
**When** I navigate to the unified sprint view
**Then** I see all active sprints with name, project, start/end dates, and progress
**And** the view loads within 2 seconds for up to 50 projects

### Story 53.2: Sprint Progress Visualization

As a **project manager**,
I want **to see visual progress bars showing how each sprint is tracking**,
So that **I can quickly identify sprints that are ahead or behind schedule**.

**Acceptance Criteria:**

**Given** multiple sprints are displayed
**When** I view the sprint list
**Then** each sprint shows a progress bar (stories completed vs total)
**And** the progress bar color indicates health (green/yellow/red)
**And** hovering shows detailed breakdown

### Story 53.3: At-Risk Sprint Identification

As a **project manager**,
I want **sprints predicted to miss deadlines to be visually highlighted**,
So that **I can focus attention on sprints needing intervention**.

**Acceptance Criteria:**

**Given** a sprint is trending behind its velocity target
**When** the unified sprint view is displayed
**Then** at-risk sprints are highlighted with a warning indicator
**And** hovering shows the predicted completion date vs target

### Story 53.4: Cross-Project Velocity Comparison

As a **project manager**,
I want **to compare sprint velocity across projects**,
So that **I can identify high-performing teams and those needing support**.

**Acceptance Criteria:**

**Given** I want to compare team performance
**When** I view the velocity comparison section
**Then** I see velocity (stories/points per sprint) for each project
**And** I can sort by velocity to see rankings
**And** I can view velocity trends over the last 5 sprints

### Story 53.5: Sprint Filtering and Aggregation

As a **project manager**,
I want **to filter sprints by status, project, and date range**,
So that **I can focus on relevant sprints and get aggregated metrics**.

**Acceptance Criteria:**

**Given** the unified sprint view is displayed
**When** I apply filters (status, project, date range, owner)
**Then** only matching sprints are shown
**And** aggregated metrics (total stories, avg velocity, blockers) update
**And** I can clear all filters with one click

---

## Epic 54: What-If Simulation Engine

**Epic Goal:** Users can create what-if scenarios to simulate changes (agent count, priority, capacity, story scope) before committing resources, with outcome predictions and side-by-side scenario comparison.

**FRs Covered:** FR-E1-1 to FR-E1-6

### Story 54.1: Scenario Creation Interface

As a **project manager**,
I want **to create a new what-if scenario by copying current system state**,
So that **I can experiment with changes without affecting production**.

**Acceptance Criteria:**

**Given** I want to simulate changes
**When** I create a new scenario
**Then** I can name it and select which projects/stories to include
**And** the scenario starts with a copy of current state
**And** the scenario is isolated from the real system

### Story 54.2: Scenario Parameter Configuration

As a **project manager**,
I want **to modify scenario parameters like agent count, priorities, and capacity**,
So that **I can simulate different resource allocation strategies**.

**Acceptance Criteria:**

**Given** I have created a scenario
**When** I edit scenario parameters
**Then** I can add/remove agents, change story priorities, adjust capacity limits
**And** changes are validated before saving
**And** I see a summary of modifications

### Story 54.3: Simulation Execution Engine

As a **project manager**,
I want **to run a simulation on my scenario and get predicted outcomes**,
So that **I can understand the impact of my proposed changes**.

**Acceptance Criteria:**

**Given** a scenario has configured parameters
**When** I run the simulation
**Then** the system predicts completion date, bottleneck probability, and resource contention
**And** results include confidence intervals (50%, 80%, 95%)
**And** simulation completes within 10 seconds for typical scenarios

### Story 54.4: Side-by-Side Scenario Comparison

As a **project manager**,
I want **to compare multiple scenarios side-by-side**,
So that **I can choose the best strategy based on trade-offs**.

**Acceptance Criteria:**

**Given** I have 2+ scenarios with simulation results
**When** I select them for comparison
**Then** I see a table comparing key metrics (completion date, risk score, utilization)
**And** I can see which scenario is best for each metric
**And** differences are highlighted visually

### Story 54.5: Scenario Persistence and History

As a **project manager**,
I want **to save scenario results and review them later**,
So that **I can reference past simulations for future decisions**.

**Acceptance Criteria:**

**Given** I have run simulations
**When** I navigate to scenario history
**Then** I see all saved scenarios with name, date, and key results
**And** I can re-open a scenario to view details or modify
**And** I can delete old scenarios to clean up

### Story 54.6: Apply Scenario to Production

As a **project manager**,
I want **to apply a verified scenario's parameters to the real system**,
So that **I can implement the optimized configuration with confidence**.

**Acceptance Criteria:**

**Given** a scenario has been simulated and reviewed
**When** I click "Apply to Production"
**Then** I see a confirmation dialog with a summary of changes
**And** after confirmation, the system applies the parameter changes
**And** an audit log entry records what was applied and when

---

## Epic 55: Monte Carlo Forecasting

**Epic Goal:** Users receive probabilistic completion dates with confidence intervals based on Monte Carlo simulations, using historical velocity data to improve accuracy over time.

**FRs Covered:** FR-E2-1 to FR-E2-6

### Story 55.1: Monte Carlo Simulation Core

As a **project manager**,
I want **the system to run Monte Carlo simulations to predict sprint completion**,
So that **I get realistic date ranges instead of single-point estimates**.

**Acceptance Criteria:**

**Given** a sprint has historical velocity data
**When** I request a forecast
**Then** the system runs 10,000 Monte Carlo iterations by default
**And** simulation completes within 5 seconds
**And** results include completion dates at 50%, 80%, and 95% confidence

### Story 55.2: Probability Distribution Visualization

As a **project manager**,
I want **to see a probability curve showing the distribution of completion dates**,
So that **I can understand the range of possible outcomes**.

**Acceptance Criteria:**

**Given** a Monte Carlo forecast has been generated
**When** I view the forecast details
**Then** I see a histogram/curve showing probability distribution
**And** the 50%, 80%, and 95% confidence dates are marked
**And** hovering over the curve shows probability for that date

### Story 55.3: Historical Velocity Learning

As a **project manager**,
I want **forecasts to improve over time by learning from historical velocity**,
So that **predictions become more accurate as the system gathers data**.

**Acceptance Criteria:**

**Given** the system has 5+ completed sprints of data
**When** a new forecast is generated
**Then** the simulation uses historical velocity distribution (not just average)
**And** the system shows "calibration score" indicating prediction accuracy
**And** forecasts improve as more data is collected

### Story 55.4: Automatic Forecast Updates

As a **project manager**,
I want **forecasts to update automatically when stories complete or velocity changes**,
So that **I always have current predictions without manual refresh**.

**Acceptance Criteria:**

**Given** an active sprint has a forecast
**When** a story is completed or velocity changes significantly (>10%)
**Then** the forecast recalculates within 10 seconds
**And** the updated forecast is visible in the dashboard
**And** significant changes (>2 days shift) trigger a notification

### Story 55.5: Forecast Accuracy Tracking

As a **project manager**,
I want **to see how accurate past forecasts were compared to actual outcomes**,
So that **I can calibrate my confidence in predictions**.

**Acceptance Criteria:**

**Given** multiple sprints have been forecasted and completed
**When** I view the forecast accuracy report
**Then** I see how often actuals fell within predicted confidence intervals
**And** I see a calibration chart (predicted vs actual)
**And** the system shows if forecasts are systematically optimistic or pessimistic

### Story 55.6: Simulation Parameter Configuration

As a **project manager**,
I want **to adjust simulation parameters like iterations and confidence levels**,
So that **I can balance accuracy vs performance for my needs**.

**Acceptance Criteria:**

**Given** I want more precise (or faster) forecasts
**When** I adjust simulation parameters
**Then** I can set iteration count (1,000 to 100,000)
**And** I can configure which confidence levels to display
**And** I can set the historical data window (last N sprints)

---

## Epic 56: Risk & Optimization Dashboard

**Epic Goal:** Users can view identified risk factors with scores, bottleneck analysis, optimization recommendations, and resource utilization trends. The system learns from applied optimizations to improve future suggestions.

**FRs Covered:** FR-E3-1 to FR-E3-6 (Risk Analysis) + FR-E4-1 to FR-E4-5 (Resource Optimization) = 11 FRs

### Story 56.1: Risk Dashboard Overview

As a **project manager**,
I want **a dashboard showing all identified risk factors with severity scores**,
So that **I can prioritize risk mitigation efforts effectively**.

**Acceptance Criteria:**

**Given** the system has analyzed project data
**When** I view the risk dashboard
**Then** I see all risk factors sorted by severity score (0-100)
**And** each risk shows type, affected projects, and trend (improving/stable/worsening)
**And** the dashboard loads within 5 seconds for up to 100 risk items

### Story 56.2: Bottleneck Identification

As a **project manager**,
I want **to see identified bottlenecks and constraints in my project flow**,
So that **I can address the root causes of delays**.

**Acceptance Criteria:**

**Given** the system has analyzed workflow patterns
**When** I view the bottleneck analysis
**Then** I see identified bottlenecks (blocked stories, overloaded agents, dependency chains)
**And** each bottleneck shows impact (stories delayed, days blocked)
**And** I can drill down to see affected stories

### Story 56.3: Risk Score Calculation

As a **project manager**,
I want **each story, sprint, and project to have a calculated risk score**,
So that **I can identify and prioritize high-risk items**.

**Acceptance Criteria:**

**Given** stories have various risk factors (dependencies, complexity, blockers)
**When** I view any item
**Then** I see a risk score (0-100)
**And** clicking the score shows contributing factors
**And** risk scores update when underlying factors change

### Story 56.4: Emerging Risk Detection

As a **project manager**,
I want **the system to detect emerging risks based on pattern analysis**,
So that **I can address risks before they become critical**.

**Acceptance Criteria:**

**Given** the system monitors project metrics
**When** patterns indicate a developing risk (velocity drop, increasing blockers)
**Then** the risk appears in the dashboard with "emerging" status
**And** I receive a proactive notification
**And** the system suggests potential causes

### Story 56.5: Configurable Risk Alerts

As a **project manager**,
I want **to configure alerts when risk scores exceed thresholds**,
So that **I'm notified of critical issues without constantly monitoring**.

**Acceptance Criteria:**

**Given** I want to be alerted for high-risk items
**When** I configure risk alert thresholds
**Then** I can set thresholds per risk type and severity
**And** I can choose notification channels (dashboard, email, Telegram)
**And** alerts trigger when thresholds are exceeded

### Story 56.6: Resource Utilization Metrics

As a **project manager**,
I want **to see resource utilization metrics and trends across the portfolio**,
So that **I can identify underutilized or overworked resources**.

**Acceptance Criteria:**

**Given** agents are working on stories
**When** I view the utilization dashboard
**Then** I see utilization % per agent with trend line
**And** overutilized (>90%) and underutilized (<30%) agents are highlighted
**And** I can view utilization by project and time period

### Story 56.7: Optimization Recommendations

As a **project manager**,
I want **the system to suggest resource allocation optimizations**,
So that **I can improve efficiency without manual analysis**.

**Acceptance Criteria:**

**Given** the system has analyzed current allocation
**When** I view optimization suggestions
**Then** I see recommendations (agent rebalancing, WIP limit changes, priority reordering)
**And** each suggestion includes estimated impact (days saved, risk reduction)
**And** I can accept or dismiss each suggestion

### Story 56.8: Optimization Scenario Runner

As a **project manager**,
I want **to run optimization scenarios targeting specific objectives**,
So that **I can find the best strategy for my current priorities**.

**Acceptance Criteria:**

**Given** I want to optimize for a specific goal
**When** I run an optimization scenario
**Then** I can select objective (minimize time, maximize throughput, balance workload, reduce blocking)
**And** the system suggests changes to achieve that objective
**And** analysis completes within 15 seconds

### Story 56.9: Underutilized Agent Detection

As a **project manager**,
I want **to identify agents with low utilization and get reallocation suggestions**,
So that **I can maximize the value from my resources**.

**Acceptance Criteria:**

**Given** agents have tracked utilization
**When** I view the optimization dashboard
**Then** underutilized agents (<30% for 3+ days) are highlighted
**And** the system suggests stories/projects they could work on
**And** suggestions consider agent skills and project needs

### Story 56.10: Optimization Impact Analysis

As a **project manager**,
I want **to see the estimated impact before accepting an optimization**,
So that **I can make informed decisions about changes**.

**Acceptance Criteria:**

**Given** an optimization suggestion is displayed
**When** I expand the suggestion details
**Then** I see estimated impact on completion date, velocity, and risk
**And** I see which stories/projects are affected
**And** I can compare before/after metrics

### Story 56.11: Optimization Learning Loop

As a **project manager**,
I want **the system to learn from which optimizations I accept or reject**,
So that **future suggestions become more relevant to my preferences**.

**Acceptance Criteria:**

**Given** I have accepted or rejected optimization suggestions
**When** new suggestions are generated
**Then** the system weights suggestions based on past acceptance patterns
**And** suggestions similar to previously accepted ones are ranked higher
**And** I can reset the learning model if needed

---

## Epic 57: Telegram Bot Integration

**Epic Goal:** Users can receive Telegram notifications for critical events, send commands to query system status, and take quick actions via interactive buttons—all from their mobile device.

**FRs Covered:** FR-I1-1 to FR-I1-5 (Notifications) + FR-I2-1 to FR-I2-5 (Commands) + FR-I3-1 to FR-I3-5 (Interactive) = 15 FRs

### Story 57.1: Telegram Bot Registration

As a **project manager**,
I want **to register a Telegram bot with the orchestrator**,
So that **I can receive notifications and send commands via Telegram**.

**Acceptance Criteria:**

**Given** I have created a bot via BotFather
**When** I configure the bot token in the orchestrator
**Then** the system validates the token and confirms connectivity
**And** I can configure which users/chats are authorized
**And** unauthorized users receive a "not authorized" response

### Story 57.2: Critical Event Notifications

As a **project manager**,
I want **to receive Telegram notifications for critical events**,
So that **I can respond to urgent issues even when away from my computer**.

**Acceptance Criteria:**

**Given** Telegram is configured as a notification channel
**When** a critical event occurs (agent blocked, conflict detected, sprint at risk)
**Then** I receive a Telegram message within 5 seconds
**And** the message includes event type, affected resource IDs, and summary
**And** the message includes relevant / commands for quick action

### Story 57.3: Notification Preference Configuration

As a **project manager**,
I want **to configure which event types trigger Telegram notifications**,
So that **I'm not overwhelmed with notifications for non-critical events**.

**Acceptance Criteria:**

**Given** I want to customize my notification preferences
**When** I configure notification settings
**Then** I can enable/disable notifications per event type
**And** I can set severity filtering (critical only, high+, all)
**And** I can configure quiet hours (no notifications during specific times)

### Story 57.4: Multi-Channel Configuration

As a **project manager**,
I want **to configure different Telegram channels for different projects/teams**,
So that **the right people receive relevant notifications**.

**Acceptance Criteria:**

**Given** I have multiple projects with different teams
**When** I configure Telegram channels
**Then** I can map projects to specific chat IDs
**And** I can configure team-specific notification rules
**And** notifications are routed to the correct channel

### Story 57.5: /status Command

As a **project manager**,
I want **to send /status to get a summary of system health**,
So that **I can quickly check system state from my phone**.

**Acceptance Criteria:**

**Given** the Telegram bot is running
**When** I send "/status"
**Then** I receive a formatted response with active agents, stories in progress, blocked items, and system health
**And** the response uses emoji indicators for quick scanning
**And** the response arrives within 3 seconds

### Story 57.6: /fleet Command

As a **project manager**,
I want **to send /fleet to see all active agents and their status**,
So that **I can monitor my agent pool from anywhere**.

**Acceptance Criteria:**

**Given** agents are running in the system
**When** I send "/fleet"
**Then** I receive a table showing each agent's name, status, current story, and project
**And** agents with issues are highlighted
**And** response is formatted for mobile readability

### Story 57.7: /sprint Command

As a **project manager**,
I want **to send /sprint to see sprint progress summary**,
So that **I can track sprint health without opening the dashboard**.

**Acceptance Criteria:**

**Given** an active sprint exists
**When** I send "/sprint [project_name]"
**Then** I see sprint name, dates, progress bar, stories by status, and blockers
**And** if project_name is omitted, I see summary for all active sprints
**And** the response includes velocity trend indicator

### Story 57.8: /health Command

As a **project manager**,
I want **to send /health to see system health check results**,
So that **I can diagnose issues remotely**.

**Acceptance Criteria:**

**Given** the system has run health checks
**When** I send "/health"
**Then** I see status of each component (API, database, agents, integrations)
**And** failing components show error details
**And** I see last check timestamp and uptime

### Story 57.9: /conflicts Command

As a **project manager**,
I want **to send /conflicts to see active resource conflicts**,
So that **I can address conflicts quickly without logging in**.

**Acceptance Criteria:**

**Given** resource conflicts exist
**When** I send "/conflicts"
**Then** I see a list of conflicts with resource, competing projects, and severity
**And** I can tap on a conflict to see resolution options
**And** empty state shows "No active conflicts"

### Story 57.10: Project Context in Commands

As a **project manager**,
I want **to scope commands to a specific project**,
So that **I get relevant results for the project I'm focused on**.

**Acceptance Criteria:**

**Given** I'm working on "api-service" project
**When** I send "/status project:api-service"
**Then** the response shows status for only that project
**And** I can set a default project context with "/setproject api-service"
**And** subsequent commands use that context until changed

### Story 57.11: Inline Action Buttons

As a **project manager**,
I want **notification messages to include inline buttons for quick actions**,
So that **I can respond to issues with one tap**.

**Acceptance Criteria:**

**Given** I receive a notification about a blocked agent
**When** I view the message
**Then** I see inline buttons: [Resume], [View Details], [Dismiss]
**And** tapping [Resume] attempts to unblock the agent
**And** the message updates to show action result (no new message)

### Story 57.12: Interactive Approval Flow

As a **project manager**,
I want **to approve or deny requests via Telegram buttons**,
So that **I can handle approvals without opening the dashboard**.

**Acceptance Criteria:**

**Given** a request requires my approval (story reassignment, conflict resolution)
**When** I receive the approval request
**Then** I see [Approve] and [Deny] buttons
**And** tapping a button records my decision and notifies the system
**And** the message updates to show my choice (e.g., "✅ Approved")

### Story 57.13: Story Quick Actions

As a **project manager**,
I want **to perform quick actions on stories via Telegram**,
So that **I can make updates without switching contexts**.

**Acceptance Criteria:**

**Given** I receive a message about a story
**When** I tap the actions menu
**Then** I can: assign to agent, change priority, block/unblock, add comment
**And** each action opens a simple prompt or uses inline selection
**And** confirmation is shown after action completes

### Story 57.14: Multi-Step Conversation Support

As a **project manager**,
I want **the bot to maintain context for multi-step actions**,
So that **I can complete complex operations through natural dialogue**.

**Acceptance Criteria:**

**Given** I start a multi-step action (e.g., "/spawn --story")
**When** the bot needs more information
**Then** it asks follow-up questions one at a time
**And** I can cancel with "/cancel" at any step
**And** the conversation context is maintained for up to 5 minutes of inactivity

### Story 57.15: Notification Deduplication

As a **project manager**,
I want **duplicate notifications to be suppressed**,
So that **I'm not spammed when the same issue triggers multiple alerts**.

**Acceptance Criteria:**

**Given** the same event type occurs multiple times for the same resource
**When** notifications would be sent
**Then** duplicate events within 5 minutes are combined into a single message
**And** the message shows count of occurrences
**And** I can configure the deduplication window per event type

---

## Cycle 10 Summary

| Metric | Value |
|--------|-------|
| **Total Epics** | 9 |
| **Total Stories** | 65 |
| **Total FRs** | 65 |
| **Total NFRs** | 26 |
| **Estimated Story Count** | 65 stories |
| **Phases** | Foundation (Epics 49-53) → Intelligence (Epics 54-56) → Integration (Epic 57) |

### Definition of Done: NFR Validation

Each story must validate applicable NFRs during implementation:

| Epic | Key NFRs to Validate in Stories |
|------|--------------------------------|
| 49 | NFR-P1 (2s load for 50 projects), NFR-F1-1, NFR-F1-2 |
| 50 | NFR-F2-1 (500ms allocation), NFR-F2-2 (100 agents, 50 projects) |
| 51 | NFR-F3-1 (1s dependency check), NFR-F3-2 (200 edges) |
| 52 | NFR-F4-1 (real-time detection), NFR-F4-2 (50 projects) |
| 53 | NFR-F5-1 (2s load), NFR-F5-2 (3s real-time updates) |
| 54 | NFR-E1-1 (10s simulation), NFR-E1-2 (accuracy over time) |
| 55 | NFR-E2-1 (5s Monte Carlo, 10K iterations) |
| 56 | NFR-E3-1 (5s risk refresh), NFR-E4-1 (15s optimization) |
| 57 | NFR-I1-1 (5s delivery), NFR-I2-1 (3s response), NFR-S1 (secure token) |

### Epic Story Count Breakdown

| Epic | Stories |
|------|---------|
| 49 - Portfolio Dashboard | 5 |
| 50 - Shared Agent Pool | 6 |
| 51 - Cross-Project Dependencies | 6 |
| 52 - Resource Conflict Detection | 5 |
| 53 - Unified Sprint View | 5 |
| 54 - What-If Simulation Engine | 6 |
| 55 - Monte Carlo Forecasting | 6 |
| 56 - Risk & Optimization Dashboard | 11 |
| 57 - Telegram Bot Integration | 15 |
| **Total** | **65** |

### Release Recommendations

**MVP Release (Epics 49-51):** 17 stories
- Portfolio Dashboard, Shared Agent Pool, Cross-Project Dependencies
- Estimated: 2-3 sprints

**Foundation Complete (Epics 49-53):** 27 stories
- Full multi-project management capability
- Estimated: 4-5 sprints

**Full Cycle 10 (All Epics):** 65 stories
- Complete portfolio intelligence + Telegram integration
- Estimated: 9-12 sprints
