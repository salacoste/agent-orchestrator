---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/implementation-artifacts/cycle-5-retrospective.md
  - _bmad-output/implementation-artifacts/cycle-6-retrospective.md
  - _bmad-output/implementation-artifacts/cycle-7-retrospective.md
---

# agent-orchestrator - Epic Breakdown (Cycle 8: Technical Debt Zero)

## Overview

Cycle 8 addresses ALL 23 technical debt items accumulated across Cycles 4-7. Goal: zero stubs, zero placeholders, zero spec-only stories. Everything wired to real data.

**Scope:** 5 epics, 23 stories.

## Epic List

### Epic 38: API Route Production Wiring (5 stories)
Replace all stub API routes with real SessionManager/Runtime integration.

### Epic 39: Module Persistence & Real-Time (4 stories)
Add JSONL/WebSocket persistence to in-memory-only collaboration and detection modules.

### Epic 40: Dashboard Real Data Integration (4 stories)
Wire placeholder components to actual data sources.

### Epic 41: SDK & Integration Completion (4 stories)
SDK SSE client, VS Code extension testing, GitHub Action CI testing, git hook installation.

### Epic 42: Spec-to-Implementation Completion (6 stories)
Implement all spec-only stories from Cycles 6-7 (annotations, ownership, handoffs, lint rules).

---

## Epic 38: API Route Production Wiring

### Story 38.1: Agent Data API — Real SessionManager Integration
Replace GET /api/agent/[id] stub with SessionManager.get() + metadata read.

### Story 38.2: Agent Activity API — ActivityDetection Integration
Replace GET /api/agent/[id]/activity stub with real ActivityDetection data.

### Story 38.3: Agent Logs API — Runtime.getOutput Integration
Replace GET /api/agent/[id]/logs stub with Runtime plugin log retrieval.

### Story 38.4: Agent Resume API — Full Resume Implementation
Replace POST /api/agent/[id]/resume stub with actual resume workflow (event publish + agent restart).

### Story 38.5: Agent Restart API — Kill + Respawn with Context
Complete POST /api/agent/[id]/restart to read session metadata and respawn with accumulated context.

---

## Epic 39: Module Persistence & Real-Time

### Story 39.1: Collaboration WebSocket Broadcasting
Add WebSocket/SSE broadcasting for team presence, claims, and decisions across connected clients.

### Story 39.2: Collaboration JSONL Persistence
Persist decisions and claims to JSONL files so they survive server restarts.

### Story 39.3: Cascade Detector Event Bus Integration
Wire cascade detector to the core event bus — listen for agent.blocked events and auto-trigger cascade.

### Story 39.4: Compound Learning Real Data Connection
Connect detectCrossSprintPatterns() and analyzeFailures() to actual Cycle 3 learning store JSONL data.

---

## Epic 40: Dashboard Real Data Integration

### Story 40.1: CascadeAlert Real Status
Wire CascadeAlert to a cascade detector instance with real agent failure events. Add onResume handler.

### Story 40.2: SprintCostPanel Real Token Data
Wire SprintCostPanel to token usage tracking from agent sessions. Parse sprint dates from sprint-status.yaml.

### Story 40.3: ConflictCheckpointPanel Real Git Data
Wire conflict detection to actual git worktree comparison. Wire checkpoint timeline to real WIP commits.

### Story 40.4: ProjectChatPanel LLM Integration
Wire chat panel to an LLM API (Claude) with project context aggregator output as system prompt.

---

## Epic 41: SDK & Integration Completion

### Story 41.1: SDK EventSource SSE Client
Implement ao.onEvent() with real EventSource connection to /api/events SSE endpoint.

### Story 41.2: VS Code Extension — vsce Package Testing
Test extension build with vsce package, verify .vsix installs in VS Code, connect to real API.

### Story 41.3: GitHub Action — CI Workflow Testing
Create test GitHub Actions workflow, verify spawn/status/recommend commands work end-to-end.

### Story 41.4: Git Hook Installation Command
Implement `ao init --hooks` that installs pre-commit hook script calling tagCommitMessage().

---

## Epic 42: Spec-to-Implementation Completion

### Story 42.1: Shared Annotation UI Component
Build React annotation component: click artifact → inline comment input → store + display.

### Story 42.2: Role-Based Agent Ownership UI
Build owner assignment UI in fleet view: avatar + name per agent, filter by owner.

### Story 42.3: Handoff Protocol Implementation
Build handoff packaging: capture agent states + pending decisions + context → deliver to recipient.

### Story 42.4: Dead-Button ESLint Rule
Create custom ESLint rule or jsx-a11y config that errors on `<button>` without onClick or disabled.

### Story 42.5: Test-Per-Story Convention Enforcement
Add validation to dev-story workflow: check ≥3 test assertions exist before marking story done.

### Story 42.6: Renders-in-Parent AC Convention
Modify create-story template to auto-include "component renders in parent layout" for component stories.

---

## FR Coverage Map

| Debt Item | Epic | Story |
|-----------|------|-------|
| GET /api/agent/[id] stub | 38 | 38.1 |
| GET /api/agent/[id]/activity stub | 38 | 38.2 |
| GET /api/agent/[id]/logs stub | 38 | 38.3 |
| POST /api/agent/[id]/resume stub | 38 | 38.4 |
| POST /api/agent/[id]/restart partial | 38 | 38.5 |
| Collaboration in-memory (WebSocket) | 39 | 39.1 |
| Collaboration persistence (JSONL) | 39 | 39.2 |
| Cascade detector event bus | 39 | 39.3 |
| Compound learning real data | 39 | 39.4 |
| CascadeAlert null status | 40 | 40.1 |
| SprintCostPanel null data | 40 | 40.2 |
| ConflictCheckpointPanel empty | 40 | 40.3 |
| ProjectChatPanel no LLM | 40 | 40.4 |
| SDK onEvent stub | 41 | 41.1 |
| VS Code extension untested | 41 | 41.2 |
| GitHub Action untested | 41 | 41.3 |
| Git hook installation missing | 41 | 41.4 |
| Shared annotations spec-only | 42 | 42.1 |
| Role-based ownership spec-only | 42 | 42.2 |
| Handoff protocol spec-only | 42 | 42.3 |
| Dead-button lint rule spec-only | 42 | 42.4 |
| Test minimum convention spec-only | 42 | 42.5 |
| Renders-in-parent AC spec-only | 42 | 42.6 |

**All 23 debt items mapped. Zero gaps.**
