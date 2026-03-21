---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/implementation-artifacts/cycle-4-retrospective.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-20-001.md
  - _bmad-output/planning-artifacts/epics-cycle-3-4.md
---

# agent-orchestrator - Epic Breakdown (Cycle 5)

## Overview

Cycle 5 focuses on completing the Cycle 4 foundation (UI wiring + API endpoints), then adding power features (Command Palette, Agent Profiles), team collaboration, and platform extensibility (SDK).

**Scope:** 6 epics, 20 stories. Epics 16-23 (Cycle 4) are fully delivered.

## Epic List

### Epic 24: DX & Quality Infrastructure
Developers have ESLint guardrails preventing recurring bugs (node imports in client, dead buttons).
**FRs:** FR-C5-1, FR-C5-2
**Priority:** Ships FIRST — prevents bugs in all subsequent work.

### Epic 25a: API Backend Wiring
Recovery API endpoints, JSONL feedback persistence, and state-machine recommendation integration are production-ready.
**FRs:** FR-C5-4, FR-C5-5, FR-C5-6
**Priority:** Second — backend before frontend.

### Epic 25b: Dashboard Component Wiring
All Cycle 4 pure logic modules are rendered in dashboard React components.
**FRs:** FR-C5-3 (anti-pattern banners, cascade UI, conflict wizard, checkpoint timeline, cost dashboard, parallelism viz, chat panel)
**Depends on:** Epic 25a
**Priority:** Third.

### Epic 26: Command Palette & Agent Profiles
Power users navigate via Cmd+K command palette, and agents are configured with personality profiles matched to story types.
**FRs:** Brainstorm #24, #70, #128
**Priority:** Parallel with 25b.

### Epic 27: Multi-User Collaboration (MVP)
Teams can see who's working on what, claim reviews, and track decisions — minimum viable collaboration for team adoption.
**FRs:** Brainstorm #111, #112, #115 (presence, claims, decision log)
**Note:** Annotations (#113), role-based ownership (#114), handoff (#116) deferred to Cycle 6.
**Priority:** Parallel with 26.

### Epic 28: SDK & Headless Mode
External tools integrate via TypeScript SDK, and CI/CD pipelines orchestrate agents without a dashboard.
**FRs:** Brainstorm #83, #85
**Depends on:** Epic 25a (stable API)
**Priority:** After 25a.

---

## Epic 24: DX & Quality Infrastructure

### Story 24.1: ESLint No-Node-Imports-In-Client Rule
As a **developer**, I want an ESLint rule that errors when `node:*` modules are imported in client-side files, So that the Next.js bundling issue from Cycle 4 (Stories 16.1, 18.4) never recurs.

**Acceptance Criteria:**
**Given** a file in `packages/web/src/components/` or client-side paths
**When** it imports from `node:fs`, `node:path`, or any `node:*` module
**Then** ESLint reports an error
**And** the rule is configured in the web package's ESLint config

### Story 24.2: Dead Button Audit & Fix
As a **user**, I want every dashboard button to either perform an action or be visually disabled, So that clicking a button never does nothing.

**Acceptance Criteria:**
**Given** all `<button>` elements across the web package
**When** audited
**Then** every button has an `onClick` handler or `disabled` attribute
**And** a code review checklist item is added for future PRs

---

## Epic 25a: API Backend Wiring

### Story 25a.1: Agent Recovery API Endpoints
As a **tech lead**, I want `/api/agent/:id/ping`, `/restart`, `/reassign` endpoints, So that the recovery buttons in AgentSessionCard actually work.

**Acceptance Criteria:**
**Given** a blocked agent session
**When** POST `/api/agent/:id/ping` is called
**Then** the system checks agent liveness via Runtime plugin and returns status
**And** POST `/api/agent/:id/restart` kills the session and respawns with context
**And** POST `/api/agent/:id/reassign` kills the agent and returns story to queue

### Story 25a.2: JSONL Recommendation Feedback Persistence
As a **PM**, I want recommendation feedback persisted to disk, So that accept/dismiss decisions survive page reloads and inform future recommendations.

**Acceptance Criteria:**
**Given** the in-memory `recommendation-feedback.ts` module
**When** `recordFeedback()` is called
**Then** the entry is appended to `_bmad-output/.recommendation-feedback.jsonl`
**And** `getFeedbackHistory()` reads from the file on startup

### Story 25a.3: State-Machine Recommendation Full Integration
As a **developer**, I want all recommendation consumers to use `getStateMachineRecommendation()` with reasoning/blockers, So that the reasoning display always has data.

**Acceptance Criteria:**
**Given** the API route already calls `getStateMachineRecommendation()` (fixed in Cycle 4 code review)
**When** any dashboard component renders a recommendation
**Then** reasoning and blockers fields are populated
**And** the expand/collapse reasoning UI shows real data

---

## Epic 25b: Dashboard Component Wiring

### Story 25b.1: Cascade Detector Dashboard Panel
As a **tech lead**, I want the cascade failure detector status displayed in the dashboard, So that I see when agents are auto-paused and can resume them.

**Acceptance Criteria:**
**Given** the `cascade-detector.ts` module
**When** cascade is triggered (3+ failures in 5 min)
**Then** dashboard shows banner: "Cascade detected — agents paused"
**And** "Resume All" button calls `detector.resume()`

### Story 25b.2: Cost & Sprint Clock Dashboard
As a **tech lead**, I want token costs, efficiency scores, and sprint clock displayed in the dashboard, So that I can monitor spending and schedule adherence.

**Acceptance Criteria:**
**Given** the `cost-tracker.ts` module
**When** the dashboard renders
**Then** sprint cost summary, efficiency rankings, and time-vs-work clock are visible

### Story 25b.3: Conflict & Checkpoint UI
As a **developer**, I want the conflict detector and checkpoint timeline rendered in agent session views, So that I can see overlapping file modifications and rollback points.

**Acceptance Criteria:**
**Given** `conflict-detector.ts` and `checkpoint-tracker.ts` modules
**When** viewing an agent session
**Then** file conflicts shown as warnings, checkpoint timeline displayed with rollback buttons

### Story 25b.4: Project Chat Panel
As a **PM**, I want the project context aggregator wired into a chat sidebar, So that I can ask questions about my project.

**Acceptance Criteria:**
**Given** `project-context-aggregator.ts` with `aggregateProjectContext()` and `generateInsights()`
**When** I open the chat panel
**Then** proactive insights appear as chat bubbles
**And** I can type questions and receive data-backed answers
**And** chat input at bottom, conversation-style layout

### Story 25b.5: Keyboard Shortcut Hook & Help Modal
As a **power user**, I want keyboard shortcuts active throughout the dashboard with a ? help modal, So that I can navigate without a mouse.

**Acceptance Criteria:**
**Given** `keyboard-shortcuts.ts` with KEYBOARD_SHORTCUTS constant
**When** I press `g+f`, `g+s`, `g+w`, `n`, `space`, `?`
**Then** navigation and actions fire correctly
**And** `?` opens a modal showing all shortcuts grouped by category

---

## Epic 26: Command Palette & Agent Profiles

### Story 26.1: Command Palette (Cmd+K)
As a **power user**, I want a Cmd+K overlay to search and execute dashboard actions, So that I can do anything from one input field.

**Acceptance Criteria:**
**Given** the dashboard is loaded
**When** I press Cmd+K (or Ctrl+K)
**Then** a search overlay appears with fuzzy-matching action list
**And** typing filters actions: "spawn agent", "show blockers", "run sprint planning"
**And** selecting an action executes it or navigates to the relevant view

### Story 26.2: Agent Personality Profiles
As a **tech lead**, I want configurable agent profiles (Careful, Speed, Security), So that I can match agent behavior to story risk level.

**Acceptance Criteria:**
**Given** agent-orchestrator.yaml config
**When** profiles are defined
**Then** each profile specifies: validation frequency, test coverage threshold, security checks
**And** profiles assignable per story or per project

### Story 26.3: Story-Agent Personality Matching
As a **PM**, I want the system to recommend which agent profile fits each story, So that complex stories get careful agents and simple ones get fast agents.

**Acceptance Criteria:**
**Given** story metadata (complexity, domain, risk) and agent profiles
**When** assignment suggestions are generated
**Then** the system recommends a profile based on story characteristics
**And** integrates with existing `assign-suggest` CLI command

---

## Epic 27: Multi-User Collaboration (MVP)

### Story 27.1: Team Presence
As a **team member**, I want to see who else is viewing the same dashboard section, So that we don't duplicate review/decision work.

**Acceptance Criteria:**
**Given** multiple users connected to the dashboard
**When** I view a sprint/story/agent page
**Then** I see avatar indicators of other users on the same page
**And** presence updates in real-time via SSE

### Story 27.2: Review Claim System
As a **team member**, I want to claim review items so others know I'm handling them, So that we don't have two people reviewing the same PR.

**Acceptance Criteria:**
**Given** a notification item (e.g., "PR needs review")
**When** I click "I'll take this"
**Then** the item is claimed under my name
**And** other team members see it's claimed and move on

### Story 27.3: Decision Log
As a **team lead**, I want every human decision logged with context, So that we have institutional memory of why choices were made.

**Acceptance Criteria:**
**Given** a human makes a decision (approve architecture, choose approach, descope story)
**When** the decision is recorded
**Then** it's stored with: WHO decided, WHAT, WHEN, WHY
**And** the decision log is viewable in the dashboard

---

## Epic 28: SDK & Headless Mode

### Story 28.1: SDK Public API Surface
As a **platform developer**, I want a defined public API for the orchestrator SDK, So that I know what's stable and what's internal.

**Acceptance Criteria:**
**Given** the existing core types and services
**When** the SDK API is defined
**Then** a `packages/sdk` workspace package exists with type exports
**And** public vs internal APIs are clearly separated

### Story 28.2: SDK Client Implementation
As a **integration developer**, I want `createOrchestrator(config)` to connect to a running orchestrator, So that I can build custom tools on top.

**Acceptance Criteria:**
**Given** a running orchestrator instance
**When** `const ao = new AgentOrchestrator(config)` is called
**Then** I can: `ao.spawn(storyId)`, `ao.onEvent('story.completed', handler)`, `ao.recommend(projectId)`

### Story 28.3: Headless Daemon Mode
As a **DevOps engineer**, I want to run the orchestrator without the web dashboard, So that CI/CD pipelines can orchestrate agents.

**Acceptance Criteria:**
**Given** `ao daemon start` CLI command
**When** the daemon runs
**Then** all orchestration features work via CLI + API
**And** no Next.js server required

### Story 28.4: SDK Documentation & Examples
As a **developer**, I want SDK documentation with usage examples, So that I can integrate quickly.

**Acceptance Criteria:**
**Given** the SDK package
**When** I read the docs
**Then** I find: quickstart guide, API reference, 3 usage examples (Slack bot, GitHub Action, VS Code extension)

---

## FR Coverage Map

| FR | Epic |
|----|------|
| FR-C5-1 (ESLint rule) | 24.1 |
| FR-C5-2 (Dead buttons) | 24.2 |
| FR-C5-3 (Module wiring) | 25b.1-25b.5 |
| FR-C5-4 (Recovery API) | 25a.1 |
| FR-C5-5 (Feedback JSONL) | 25a.2 |
| FR-C5-6 (SM recommendation) | 25a.3 |
| #24 (Command Palette) | 26.1 |
| #70 (Agent Profiles) | 26.2 |
| #128 (Personality Matching) | 26.3 |
| #111 (Team Presence) | 27.1 |
| #112 (Claim System) | 27.2 |
| #115 (Decision Log) | 27.3 |
| #83 (SDK) | 28.1, 28.2, 28.4 |
| #85 (Headless Mode) | 28.3 |

**All 17 FRs mapped. Zero gaps.**
