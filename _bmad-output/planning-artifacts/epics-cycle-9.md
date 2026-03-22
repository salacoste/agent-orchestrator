---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-03-20-001.md
  - _bmad-output/implementation-artifacts/cycle-8-retrospective-epics-38-41.md
---

# agent-orchestrator — Epic Breakdown (Cycle 9: Autonomy, Scale & Frontier)

## Overview

Cycle 9 builds on the complete Cycle 8 foundation (198 stories, zero debt) to add autonomous operations, power-user dashboard features, team-scale infrastructure, and frontier experiments. Derived from 248 brainstorming ideas with unimplemented items prioritized through party-mode team debate.

**Scope:** 7 epics, ~42 stories across 2 phases.

**Phase 1 (parallel):** Epics 43, 44, 45, 46a, 48 — no cross-dependencies
**Phase 2 (after 46a):** Epics 46b, 47 — need infrastructure from 46a

## Requirements (from Brainstorming Ideas)

### Functional Requirements

- FR-C9-1: Autopilot mode — auto-advance workflows without human intervention (#3)
- FR-C9-2: Sprint forecasting — predictive completion probability (#25)
- FR-C9-3: Agent queue — priority-based auto-spawn backlog (#88)
- FR-C9-4: Loop detection — break infinite agent cycles (#71)
- FR-C9-5: Scope creep detection — token/file usage vs estimate (#68)
- FR-C9-6: WIP limits — constrain concurrent agents (#214)
- FR-C9-7: Executive view toggle — PM vs dev lens (#7)
- FR-C9-8: Split screen — artifact + agent side-by-side (#76)
- FR-C9-9: Agent log streaming — live terminal in browser (#104)
- FR-C9-10: Sprint health score — composite metric (#97)
- FR-C9-11: Progressive UI complexity — grows with expertise (#135)
- FR-C9-12: Mobile companion PWA — phone notifications (#67)
- FR-C9-13: Notification digest — daily summary (#192)
- FR-C9-14: Focus mode — single story deep dive (#98)
- FR-C9-15: Story replay — watch agent work as time-lapse (#59)
- FR-C9-16: Time travel — navigate historical state (#52)
- FR-C9-17: Post-mortem auto-generator (#131)
- FR-C9-18: ROI calculator — prove agent value (#61)
- FR-C9-19: Meeting summary generator — standup button (#92)
- FR-C9-20: Confidence indicators per file (#228)
- FR-C9-21: Reasoning trail — show agent decision logic (#226)
- FR-C9-22: Immutable audit log — SOC2-ready event trail (#108)
- FR-C9-23: State snapshots — export/import full state (#82)
- FR-C9-24: Inter-agent messaging infrastructure
- FR-C9-25: Auth/multi-tenant — user roles and permissions (#91)
- FR-C9-26: Approval workflows — risk-proportional human gates (#109)
- FR-C9-27: Resource pool — shared agent capacity (#95)
- FR-C9-28: Agent isolation levels (#110)
- FR-C9-29: Agent collaboration — agents negotiate directly (#55)
- FR-C9-30: Agent sandbox — per-story permission boundaries (#106)
- FR-C9-31: NLU orchestration — natural language commands (#60)
- FR-C9-32: Conflict resolution wizard — AI merge suggestion (#39)
- FR-C9-33: Agent hot-swap — replace running agent (#74)
- FR-C9-34: Pre-flight check — agent success prediction (#129)
- FR-C9-35: Monte Carlo sprint simulator (#146)
- FR-C9-36: 3D dependency visualization spike (#117)
- FR-C9-37: Voice navigation spike (#155)
- FR-C9-38: Swarm intelligence spike (#246)
- FR-C9-39: Business hours awareness — time-aware spawning (#232)
- FR-C9-40: Deadline pressure adaptation (#234)

### Non-Functional Requirements

- NFR-C9-1: All new features must degrade gracefully when dependencies unavailable
- NFR-C9-2: Auth system must support local config role (v1) without full OAuth
- NFR-C9-3: Audit log must be append-only and immutable
- NFR-C9-4: Mobile PWA must work offline for read-only status
- NFR-C9-5: Spikes must be timeboxed — produce technical assessment, not production code

## Epic List

### Epic 43: Autonomous Pipeline (8 stories)
Users can configure the orchestrator to advance workflows, spawn agents, and manage capacity automatically — reducing manual intervention to exception handling only.
**FRs covered:** FR-C9-1, FR-C9-2, FR-C9-3, FR-C9-4, FR-C9-5, FR-C9-6, FR-C9-39, FR-C9-40

### Epic 44: Power User Dashboard (8 stories)
Users get role-appropriate views, live agent terminals, mobile access, and adaptive UI that matches their expertise level — transforming the dashboard from monitoring tool to command center.
**FRs covered:** FR-C9-7, FR-C9-8, FR-C9-9, FR-C9-10, FR-C9-11, FR-C9-12, FR-C9-13, FR-C9-14

### Epic 45: Intelligence & Replay (7 stories)
Users can replay agent sessions, navigate historical state, auto-generate post-mortems and meeting summaries, and see agent reasoning — turning the event log into an intelligence layer.
**FRs covered:** FR-C9-15, FR-C9-16, FR-C9-17, FR-C9-18, FR-C9-19, FR-C9-20, FR-C9-21

### Epic 46a: Infrastructure Foundation (3 stories)
The platform gains immutable audit logging, state snapshot export/import, and inter-agent messaging — foundational infrastructure that unlocks team features and agent autonomy.
**FRs covered:** FR-C9-22, FR-C9-23, FR-C9-24

### Epic 46b: Team Features (4 stories)
Teams can manage user roles and permissions, create approval workflows, share agent capacity, and isolate agent environments — enabling multi-user production deployment.
**FRs covered:** FR-C9-25, FR-C9-26, FR-C9-27, FR-C9-28

### Epic 47: Agent Autonomy v2 (6 stories)
Agents gain the ability to negotiate with each other, operate in sandboxed environments, accept natural language commands, resolve conflicts with AI assistance, and be hot-swapped mid-session.
**FRs covered:** FR-C9-29, FR-C9-30, FR-C9-31, FR-C9-32, FR-C9-33, FR-C9-34

### Epic 48: Frontier & Simulation (6 stories)
The platform explores next-generation capabilities: Monte Carlo sprint simulation (full implementation), plus investigation spikes for 3D visualization, voice navigation, and swarm intelligence.
**FRs covered:** FR-C9-35, FR-C9-36, FR-C9-37, FR-C9-38

---

## FR Coverage Map

| FR | Epic | Brainstorm # | Description |
|----|------|-------------|-------------|
| FR-C9-1 | 43 | #3 | Autopilot mode |
| FR-C9-2 | 43 | #25 | Sprint forecasting |
| FR-C9-3 | 43 | #88 | Agent queue |
| FR-C9-4 | 43 | #71 | Loop detection |
| FR-C9-5 | 43 | #68 | Scope creep detection |
| FR-C9-6 | 43 | #214 | WIP limits |
| FR-C9-7 | 44 | #7 | Executive view |
| FR-C9-8 | 44 | #76 | Split screen |
| FR-C9-9 | 44 | #104 | Log streaming |
| FR-C9-10 | 44 | #97 | Health score |
| FR-C9-11 | 44 | #135 | Progressive UI |
| FR-C9-12 | 44 | #67 | Mobile PWA |
| FR-C9-13 | 44 | #192 | Notification digest |
| FR-C9-14 | 44 | #98 | Focus mode |
| FR-C9-15 | 45 | #59 | Story replay |
| FR-C9-16 | 45 | #52 | Time travel |
| FR-C9-17 | 45 | #131 | Post-mortem generator |
| FR-C9-18 | 45 | #61 | ROI calculator |
| FR-C9-19 | 45 | #92 | Meeting summary |
| FR-C9-20 | 45 | #228 | Confidence indicators |
| FR-C9-21 | 45 | #226 | Reasoning trail |
| FR-C9-22 | 46a | #108 | Immutable audit log |
| FR-C9-23 | 46a | #82 | State snapshots |
| FR-C9-24 | 46a | — | Inter-agent messaging |
| FR-C9-25 | 46b | #91 | Auth/multi-tenant |
| FR-C9-26 | 46b | #109 | Approval workflows |
| FR-C9-27 | 46b | #95 | Resource pool |
| FR-C9-28 | 46b | #110 | Agent isolation |
| FR-C9-29 | 47 | #55 | Agent collaboration |
| FR-C9-30 | 47 | #106 | Agent sandbox |
| FR-C9-31 | 47 | #60 | NLU orchestration |
| FR-C9-32 | 47 | #39 | Conflict resolution wizard |
| FR-C9-33 | 47 | #74 | Agent hot-swap |
| FR-C9-34 | 47 | #129 | Pre-flight check |
| FR-C9-35 | 48 | #146 | Sprint simulator |
| FR-C9-36 | 48 | #117 | 3D viz spike |
| FR-C9-37 | 48 | #155 | Voice nav spike |
| FR-C9-38 | 48 | #246 | Swarm spike |
| FR-C9-39 | 43 | #232 | Business hours |
| FR-C9-40 | 43 | #234 | Deadline adaptation |

**All 40 FRs mapped. Zero gaps.**

---

## Epic 43: Autonomous Pipeline

**Build order:** 43.3 → 43.1 → [43.2, 43.5, 43.6 parallel] → 43.4 → [43.7, 43.8 parallel]

### Story 43.3: WIP Limits & Spawn Queue

As a team lead,
I want to set a maximum number of concurrent agents with automatic queuing,
so that resources aren't wasted and excess spawns wait their turn.

**Acceptance Criteria:**

**Given** `maxConcurrentAgents: N` is set in config
**When** a spawn request (manual or autopilot) would exceed N running agents
**Then** the spawn is QUEUED in a FIFO queue (not rejected)
**And** queued spawns execute automatically when a running agent finishes
**And** the queue processes spawns ONE AT A TIME sequentially (no race conditions)
**And** `GET /api/sprint/queue` returns current queue state
**And** the dashboard shows "N/M agents active (K queued)"

### Story 43.1: Autopilot Mode — Supervised Workflow Advancement

As a team lead,
I want the orchestrator to automatically advance workflows when stories complete,
so that I don't have to manually trigger the next agent spawn.

**Acceptance Criteria:**

**Given** `autopilot: off | supervised | autonomous` is set in config (default: off)
**When** a story reaches status "done" in sprint-status.yaml
**Then** autopilot finds the next backlog story and enqueues a spawn via the queue (43.3)

**Mode behavior:**
- **off:** No auto-spawning (current behavior)
- **supervised:** Sends notification "Autopilot wants to spawn for story Y — Approve?" with 5-minute timeout. No response → queued, not auto-approved.
- **autonomous:** Spawns automatically, notifies after the fact.

**And** autopilot state is visible on the dashboard (off/supervised/autonomous + recent actions)
**And** if no valid next story exists, autopilot pauses with "No next story — manual action needed"

**Subtasks:** (A) Backend engine — event listener + sprint-status reader + queue integration + config. (B) Dashboard UI — mode toggle, status indicator, recent auto-actions.

### Story 43.2: Sprint Forecaster — Predictive Completion Probability

As a team lead,
I want to see the probability of completing the sprint on time,
so that I can adjust scope or resources before it's too late.

**Acceptance Criteria:**

**Given** the learning store has ≥5 completed session records
**When** I view the sprint dashboard
**Then** a forecast shows P50/P80/P95 completion dates
**And** a confidence indicator shows data quality (high/medium/low based on sample size)
**And** when learning store has <5 records, show "Insufficient data" with configurable defaults

### Story 43.5: Infinite Loop Detector — Agent Cycle Breaker

As a system operator,
I want the orchestrator to detect agents stuck in restart loops,
so that tokens aren't burned on unresolvable issues.

**Acceptance Criteria:**

**Given** an agent has been restarted/resumed ≥3 times for the same story
**When** the next restart/resume is attempted
**Then** the agent is paused with status "loop-detected"
**And** a notification is sent: "Agent X appears stuck on story Y — manual investigation needed"
**And** loop detection tracks restart/resume SESSION LIFECYCLE events (not token usage — that's scope creep)
**And** the loop threshold is configurable (default: 3)

### Story 43.6: Scope Creep Detector — Token/File Budget Monitoring

As a team lead,
I want warnings when an agent's token usage or file changes exceed expected bounds,
so that scope creep is caught early.

**Acceptance Criteria:**

**Given** historical averages exist for tokens-per-story and files-per-story from the learning store
**When** a running agent exceeds 2x the historical average
**Then** a "scope creep" warning appears on the dashboard
**And** the warning includes: agent ID, story, current usage vs average, suggested action
**And** configurable threshold multiplier (default: 2x)

### Story 43.4: Priority Queue Upgrade

As a developer,
I want queued agent spawns to execute in priority order,
so that the most important stories get agents first.

**Acceptance Criteria:**

**Given** multiple stories are queued for agent spawn (via 43.3 FIFO queue)
**When** a running agent slot becomes available
**Then** the highest-priority queued story spawns next (upgrades FIFO to priority)
**And** priority is determined by: blocked-dependency-unblocked > story order in sprint-status.yaml
**And** queue state shows priority ordering via `GET /api/sprint/queue`

### Story 43.7: Business Hours Awareness — Time-Sensitive Spawning

As a team operating across timezones,
I want autopilot spawning to respect business hours,
so that agents don't spawn during off-hours when no one can respond to issues.

**Acceptance Criteria:**

**Given** `businessHours: { start: "09:00", end: "18:00", timezone: "UTC" }` in config
**When** autopilot would spawn an agent outside business hours
**Then** the spawn is queued until the next business hour window
**And** manual spawns are NOT restricted (only autopilot)
**And** business hours config is optional (default: 24/7)

### Story 43.8: Deadline Pressure Adaptation

As a team lead approaching a deadline,
I want the orchestrator to adapt its behavior when the sprint clock is tight,
so that it prioritizes completion over thoroughness.

**Acceptance Criteria:**

**Given** the sprint clock shows <20% time remaining with >30% stories undone
**When** the system detects deadline pressure
**Then** the dashboard shows a "Deadline pressure" indicator
**And** recommendations shift to: skip optional reviews, parallelize more aggressively, suggest scope cuts
**And** the pressure threshold is configurable

---

## Epic 44: Power User Dashboard

### Story 44.1: Executive View — Role-Based Widget Grid

As a PM or team lead,
I want a dashboard layout customized for my role,
so that I see the most relevant information first.

**Acceptance Criteria:**

**Given** `userRole: pm | dev | lead | admin` is configured (local config, no auth)
**When** I open the dashboard
**Then** widgets are arranged in a role-appropriate default order
**And** PM default: burndown, blockers, decisions, cost
**And** Dev default: phase bar, agents, conflicts, recommendations
**And** Lead default: phase bar, burndown, agents, cost, conflicts
**And** role is selectable via dropdown in the dashboard header

### Story 44.2: Split Screen — Artifact + Agent Side-by-Side

As a developer reviewing agent work,
I want to view an artifact alongside the agent's session,
so that I can see the context and output together.

**Acceptance Criteria:**

**Given** I'm viewing an agent session card
**When** I click "Split View"
**Then** the dashboard splits into two panes: agent session on left, artifact/story on right
**And** panes are resizable via drag handle
**And** pressing Escape or a close button returns to single-pane view

### Story 44.3: Agent Log Streaming — Live Terminal in Browser

As a developer monitoring an agent,
I want to see live agent output in the browser,
so that I don't need to switch to a terminal window.

**Acceptance Criteria:**

**Given** an agent session is in "working" status
**When** I open the log stream view
**Then** the last 100 log lines are loaded immediately (via existing logs API)
**And** new log lines appear in real-time via SSE polling (5s interval)
**And** the terminal view uses monospace font with ANSI color support
**And** a "Copy All" button copies the visible log content

### Story 44.4: Sprint Health Score — Composite Metric

As a team lead,
I want a single 0-100 health score for the sprint,
so that I can assess sprint status at a glance.

**Acceptance Criteria:**

**Given** active sprint data is available
**When** I view the dashboard
**Then** a health score (0-100) is displayed with color coding (green >70, amber 40-70, red <40)
**And** score is computed from: story completion %, blocker count, agent failure rate, cost burn rate
**And** hovering shows the score breakdown
**And** `GET /api/sprint/health` returns the score and components

### Story 44.5: Progressive UI Complexity

As a new user,
I want a simpler dashboard that reveals features as I gain expertise,
so that I'm not overwhelmed on first use.

**Acceptance Criteria:**

**Given** a user's experience level is tracked (new/intermediate/advanced via localStorage)
**When** a new user opens the dashboard for the first time
**Then** only essential widgets are shown (phase bar, recommendation, agents)
**And** a "Show more" option reveals additional widgets
**And** after 5 sessions, intermediate features unlock automatically
**And** an "Expert mode" toggle shows everything immediately

### Story 44.6: Focus Mode — Single Story Deep Dive

As a developer,
I want to focus on a single story with all its context,
so that I can deeply review one agent's work without distraction.

**Acceptance Criteria:**

**Given** I click on a story in the dashboard
**When** focus mode activates
**Then** the dashboard shows ONLY that story's: agent status, log stream, modified files, test results
**And** all other widgets are hidden
**And** breadcrumb shows: Dashboard > Story X-Y
**And** pressing Escape or back returns to the full dashboard

### Story 44.7: Notification Digest — Daily Summary

As a team lead who doesn't watch the dashboard constantly,
I want a daily email/notification summary,
so that I stay informed without real-time monitoring.

**Acceptance Criteria:**

**Given** `notificationDigest: { enabled: true, schedule: "09:00", timezone: "UTC" }` in config
**When** the scheduled time arrives
**Then** a digest is generated with: stories completed since last digest, active agents, blockers, cost summary
**And** digest is sent via the configured notifier plugin (desktop/slack/webhook)
**And** `GET /api/sprint/digest` returns the digest content on demand

### Story 44.8: Mobile Companion PWA (STRETCH)

As a team lead on the go,
I want to check agent status from my phone,
so that I can respond to critical issues away from my desk.

**Acceptance Criteria:**

**Given** the dashboard is accessed from a mobile browser
**When** I add it to my home screen
**Then** it installs as a PWA with offline read-only status cache
**And** push notifications work for critical alerts (cascade, blocked agents)
**And** the mobile layout shows: health score, active agents, blocker count, quick actions (approve/pause)

**Note:** Marked as STRETCH — deferred to Cycle 10 if epic runs long.

---

## Epic 45: Intelligence & Replay

### Story 45.1: Story Replay — Agent Session Time-Lapse

As a team lead reviewing completed work,
I want to replay an agent's session as a time-lapse of events,
so that I can understand what the agent did and how it approached the story.

**Acceptance Criteria:**

**Given** a completed agent session with events in the JSONL event log
**When** I click "Replay" on a session card
**Then** events are displayed chronologically in an animated timeline
**And** each event shows: timestamp, type, description (reusing activity API from 38.2)
**And** playback speed is adjustable (1x, 2x, 5x, 10x)
**And** I can pause, scrub, and jump to any point in the timeline

### Story 45.2: Time Travel — Historical State Navigation

As a developer investigating a past issue,
I want to see the state of the project at any historical point,
so that I can understand what was happening when a problem occurred.

**Acceptance Criteria:**

**Given** events exist in the JSONL event log (using existing events.jsonl, v1 — no immutable audit required)
**When** I select a timestamp via a date/time picker
**Then** the dashboard reconstructs the state at that timestamp: active sessions, phase, blockers
**And** a "Time Travel" banner shows "Viewing state at: [timestamp]"
**And** clicking "Return to Present" restores live data
**And** if no events exist for the selected time range, show "No data available for this period"

### Story 45.3: Post-Mortem Auto-Generator

As a team lead after a failed sprint or story,
I want an automatically generated post-mortem analysis,
so that I can understand failure patterns without manually investigating.

**Acceptance Criteria:**

**Given** one or more sessions have outcome "failed" or "blocked" in the learning store
**When** I click "Generate Post-Mortem" on the dashboard or via `GET /api/sprint/postmortem`
**Then** the system produces a structured report with: timeline of failures, error categories, affected files, pattern analysis (reusing compound-learning from 39.4)
**And** the report includes actionable recommendations based on failure patterns
**And** if no failures exist, show "No failures to analyze"

### Story 45.4: ROI Calculator — Agent Value Proof

As a team lead justifying AI agent usage,
I want to see the return on investment for agent sessions,
so that I can prove value to stakeholders.

**Acceptance Criteria:**

**Given** completed sessions exist with cost data (tokens) and story completion data
**When** I view the ROI panel or call `GET /api/sprint/roi`
**Then** the system shows: total token cost ($), estimated human-hours saved, cost per story, efficiency ratio
**And** human-hours estimate uses configurable rate (default: 4 hours per story)
**And** the calculation is transparent: "X stories × $Y tokens vs X stories × Z human-hours × $W/hour"

### Story 45.5: Meeting Summary Generator — Standup Button

As a team lead preparing for standup,
I want a one-click summary of what happened since the last standup,
so that I don't have to manually compile updates.

**Acceptance Criteria:**

**Given** sessions and events exist from the last 24 hours
**When** I click "Generate Standup" or call `GET /api/sprint/standup`
**Then** the system produces: stories completed yesterday, stories in progress, blockers, key decisions made
**And** output is formatted as markdown suitable for pasting into Slack/Teams
**And** a "Copy to Clipboard" button is provided

### Story 45.6: Confidence Indicators — Per-File Agent Certainty

As a code reviewer,
I want to see which files the agent was most/least confident about,
so that I can focus my review on uncertain areas.

**Acceptance Criteria:**

**Given** a completed agent session with file modification data
**When** I view the session details
**Then** each modified file shows a confidence indicator (high/medium/low)
**And** confidence is computed from: number of retries on that file, error count, time spent relative to file size
**And** files are sorted by confidence (lowest first — "review these first")

### Story 45.7: Reasoning Trail — Agent Decision Logic

As a code reviewer,
I want to see WHY the agent made specific decisions,
so that I can validate the approach, not just the code.

**Acceptance Criteria:**

**Given** an agent session has completed
**When** I view the reasoning trail panel
**Then** key decision points are displayed: library choices, architecture decisions, test approach, trade-offs
**And** each decision shows: what was decided, alternatives considered, rationale
**And** data is extracted from agent session summary and learning record metadata

### Story 45.8: Sprint Diff — Sprint-Over-Sprint Comparison

As a team lead tracking improvement,
I want to compare two sprints side by side,
so that I can see velocity trends and recurring issues.

**Acceptance Criteria:**

**Given** learning data exists for two or more sprints
**When** I select two sprints to compare via `GET /api/sprint/diff?a=sprint1&b=sprint2`
**Then** the comparison shows: stories completed, avg duration, failure rate, top error categories, cost
**And** improvements are highlighted in green, regressions in red
**And** a "Trends" section shows direction arrows for each metric

---

## Epic 46a: Infrastructure Foundation

### Story 46a.1: Immutable Audit Log

As a system administrator requiring compliance,
I want all state-changing actions to be recorded in an immutable append-only log,
so that there is a tamper-proof trail of everything that happened.

**Acceptance Criteria:**

**Given** any state-changing action occurs (spawn, kill, resume, status change, config update)
**When** the action completes
**Then** an audit entry is appended to `audit.jsonl` with: timestamp, actor, action, target, before/after state
**And** the audit log is APPEND-ONLY — no edits, no deletes, no rotation (separate from events.jsonl which rotates)
**And** `GET /api/audit?since=timestamp&limit=N` returns audit entries
**And** entries are cryptographically chained (each entry includes hash of previous entry) for tamper detection

### Story 46a.2: State Snapshots — Export/Import

As a team migrating or backing up the orchestrator,
I want to export the full system state to a JSON file and restore from it,
so that state is portable and recoverable.

**Acceptance Criteria:**

**Given** the orchestrator has active sessions, sprint status, and collaboration state
**When** I call `GET /api/state/export` or `ao state export`
**Then** a JSON file is produced containing: all session metadata, sprint-status.yaml content, collaboration state (decisions, claims, annotations, ownership), learning store records
**And** `POST /api/state/import` or `ao state import <file>` restores all state from the JSON file
**And** import validates the JSON schema before applying
**And** import is non-destructive — merges with existing state (does not delete data not in the snapshot)

### Story 46a.3: Inter-Agent Messaging Bus

As a platform enabling agent-to-agent communication,
I want a message bus that agents can publish and subscribe to,
so that agents can coordinate without human intermediary.

**Acceptance Criteria:**

**Given** the EventBus interface exists in `types.ts`
**When** a concrete in-memory implementation is created
**Then** publishers can send typed messages to named channels
**And** subscribers receive messages on channels they're subscribed to
**And** messages are persisted to JSONL for replay (reusing existing JSONL patterns)
**And** the bus is accessible via `getMessageBus()` from service registry
**And** bus supports at-least-once delivery (messages survive server restart via JSONL replay)

---

## Epic 46b: Team Features

### Story 46b.1: Authentication — Config-Based User Identity

As a team using the dashboard,
I want user identity based on config so that actions are attributed to the correct person.

**Acceptance Criteria:**

**Given** `users` section exists in `agent-orchestrator.yaml` with name, role, email per user
**When** a user selects their identity via dashboard dropdown (stored in localStorage)
**Then** all API requests include `X-AO-User` header with the selected user
**And** API routes attribute actions to the identified user (audit log, decisions, ownership)
**And** if no user selected, default to "anonymous" with "admin" role
**And** `GET /api/users` returns the configured user list

### Story 46b.2: Approval Workflows — Human Gates

As a team lead,
I want certain actions to require approval before execution,
so that risky operations have human oversight.

**Acceptance Criteria:**

**Given** `approvalRequired` is configured for specific actions (e.g., `spawn`, `kill`, `autopilot-advance`)
**When** an action requiring approval is triggered
**Then** the action is PENDING until an authorized user approves via dashboard or API
**And** pending actions show in a "Needs Approval" queue on the dashboard
**And** approvals are logged in the audit trail with approver identity
**And** configurable auto-approve timeout (default: none — waits indefinitely)

### Story 46b.3: Resource Pool — Shared Agent Capacity

As a team running multiple projects,
I want shared agent capacity across projects with per-project limits,
so that one project can't starve others of resources.

**Acceptance Criteria:**

**Given** `resourcePool: { total: 10, projects: { app: 6, lib: 4 } }` in config
**When** a project's running agents reach its limit
**Then** new spawns are queued (reusing 43.3 queue mechanism)
**And** the dashboard shows per-project usage: "app: 4/6, lib: 2/4, pool: 6/10"
**And** `GET /api/resources` returns pool state
**And** if no resource pool configured, behavior is unchanged (unlimited per project)

### Story 46b.4: Agent Isolation Levels

As a security-conscious team,
I want to configure isolation levels for agent sessions,
so that sensitive projects get stronger sandboxing.

**Acceptance Criteria:**

**Given** `isolation: shared | isolated | quarantined` is configurable per project
**When** an agent spawns in an "isolated" project
**Then** the agent gets its own worktree with no access to other project worktrees
**And** "quarantined" adds: network restrictions, no git push, read-only access to shared resources
**And** "shared" is the default (current behavior — shared worktree directory)
**And** isolation level is visible on agent session cards

---

## Epic 47: Agent Autonomy v2

### Story 47.1: Agent Collaboration — Direct Negotiation

As a system enabling smart multi-agent work,
I want agents to negotiate directly when they detect conflicts,
so that common issues are resolved without human escalation.

**Acceptance Criteria:**

**Given** two agents are working on stories that touch overlapping files
**When** the conflict detector identifies the overlap
**Then** agents exchange messages via the messaging bus (46a.3): "I'm modifying src/auth.ts — can you avoid it?"
**And** the receiving agent acknowledges and adjusts its approach OR escalates to human
**And** the negotiation is logged in the audit trail
**And** negotiation timeout: if no agreement in 2 minutes, escalate to human notification

### Story 47.2: Agent Sandbox — Permission Boundaries

As a security administrator,
I want per-story permission boundaries for agents,
so that an agent working on a UI story can't modify database schemas.

**Acceptance Criteria:**

**Given** `sandbox: { allowedPaths: ["src/components/**"], deniedPaths: ["src/db/**"] }` in story spec
**When** an agent attempts to modify a file outside allowed paths
**Then** the modification is BLOCKED (agent receives error)
**And** a notification is sent: "Agent X tried to modify denied path Y"
**And** sandbox rules are configurable per project and overridable per story
**And** default sandbox: allow all (current behavior — opt-in restriction)

### Story 47.3: NLU Orchestration — Natural Language Commands

As a user who prefers talking to clicking,
I want to type natural language commands in the dashboard,
so that I can orchestrate agents conversationally.

**Acceptance Criteria:**

**Given** the command palette (Cmd+K) is open
**When** I type "spawn an agent for the auth story" or "show me blocked stories"
**Then** the system parses the intent and executes the matching CLI/API action
**And** parsing uses pattern matching (not LLM) for common commands: spawn, kill, status, resume, list
**And** if intent is ambiguous, show 2-3 suggested interpretations to pick from
**And** fallback: unrecognized commands forwarded to project chat (40.4) for LLM response

### Story 47.4: Conflict Resolution Wizard — AI Merge Suggestion

As a developer facing a merge conflict between agents,
I want an AI-assisted resolution suggestion,
so that I can resolve conflicts faster.

**Acceptance Criteria:**

**Given** a file conflict is detected between two agents
**When** I click "Resolve" on the conflict panel
**Then** the system shows a 3-way diff: base, agent A's version, agent B's version
**And** if `ANTHROPIC_API_KEY` is configured, an AI-suggested merge is generated
**And** I can accept the suggestion, edit it, or choose one agent's version
**And** without API key, only the 3-way diff is shown (no AI suggestion)

### Story 47.5: Agent Hot-Swap — Replace Running Agent

As a team lead who wants to switch agent types mid-story,
I want to replace a running agent while preserving its work context,
so that I can switch from a fast agent to a careful one without losing progress.

**Acceptance Criteria:**

**Given** an agent is running on a story
**When** I click "Swap Agent" and select a new agent type (e.g., claude-code → codex)
**Then** the current agent is gracefully stopped (work committed to branch)
**And** a new agent of the selected type is spawned on the same story + branch + worktree
**And** the new agent receives context: previous agent's summary, files modified, decisions made
**And** the swap is logged in the audit trail

### Story 47.6: Pre-Flight Check — Agent Success Prediction

As a team lead deciding whether to spawn an agent,
I want a success prediction based on historical data,
so that I can avoid spawning agents on stories likely to fail.

**Acceptance Criteria:**

**Given** the learning store has historical session data
**When** I'm about to spawn an agent for a story
**Then** a pre-flight check shows: predicted success rate, estimated duration, risk factors
**And** prediction uses domain matching: stories with similar `domainTags` in learning history
**And** risk factors include: story complexity (estimated from AC count), domain novelty, recent failure rate
**And** pre-flight is advisory — it never BLOCKS spawning, only warns

---

## Epic 48: Frontier & Simulation

### Story 48.1: Sprint Simulator Engine — Monte Carlo Core

As a team lead planning a sprint,
I want to simulate sprint outcomes using historical data,
so that I can see the probability distribution of completion dates.

**Acceptance Criteria:**

**Given** the learning store has ≥10 completed sessions and a backlog of stories exists
**When** I call `GET /api/sprint/simulate?iterations=1000`
**Then** the system runs N Monte Carlo iterations, sampling story durations from historical sessions with matching domain tags
**And** returns: P50, P80, P95 completion dates, probability of completing on time, bottleneck stories
**And** confidence indicator shows data quality based on sample coverage
**And** when learning store has insufficient data, use configurable default distribution

### Story 48.2: Sprint Simulator API & Dashboard

As a team lead,
I want the simulation results displayed on the dashboard,
so that I can make data-driven scope decisions.

**Acceptance Criteria:**

**Given** simulation results are available from 48.1
**When** I view the simulator panel on the dashboard
**Then** a probability distribution chart shows completion date ranges
**And** color coding: green (>80% chance on time), amber (50-80%), red (<50%)
**And** "What-if" controls: remove stories from backlog and re-simulate instantly
**And** simulation runs on demand (button) not automatically (avoids performance cost)

### Story 48.3: Sprint Simulator — Scenario Comparison

As a team lead evaluating trade-offs,
I want to compare multiple simulation scenarios side by side,
so that I can choose the best scope for the sprint.

**Acceptance Criteria:**

**Given** I've run 2+ simulations with different story selections
**When** I click "Compare Scenarios"
**Then** scenarios are displayed side-by-side with: completion probability, risk level, cost estimate
**And** the recommended scenario is highlighted based on highest completion probability within budget

### Story 48.4: Investigation Spike — 3D Dependency Visualization

As a team exploring visualization options,
I want a technical assessment of Three.js for artifact dependency graphs,
so that we can decide whether to invest in 3D visualization.

**Acceptance Criteria:**

**Given** this is a TIMEBOXED investigation spike
**When** the spike is complete
**Then** a technical assessment document exists in `_bmad-output/implementation-artifacts/`
**And** the document contains: feasibility analysis, 2+ approach options, performance considerations, effort estimate, go/no-go recommendation
**And** optional: proof-of-concept in `packages/web/src/experiments/` (non-production)

### Story 48.5: Investigation Spike — Voice Navigation

As a team exploring accessibility options,
I want a technical assessment of browser Speech API for dashboard navigation,
so that we can decide whether to add voice control.

**Acceptance Criteria:**

**Given** this is a TIMEBOXED investigation spike
**When** the spike is complete
**Then** a technical assessment document exists with: browser support matrix, API capabilities, integration approach, effort estimate, go/no-go recommendation
**And** optional: proof-of-concept in `packages/web/src/experiments/`

### Story 48.6: Investigation Spike — Swarm Intelligence

As a team exploring autonomous agent coordination,
I want a technical assessment of decentralized agent decision-making,
so that we can decide whether swarm patterns are feasible.

**Acceptance Criteria:**

**Given** this is a TIMEBOXED investigation spike
**When** the spike is complete
**Then** a technical assessment document exists with: swarm algorithm options (ant colony, particle swarm, stigmergy), applicability to agent orchestration, messaging requirements (depends on 46a.3), effort estimate, go/no-go recommendation
