---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
workflowStatus: complete
completedAt: '2026-03-13'
inputDocuments:
  - _bmad-output/planning-artifacts/prd-workflow-dashboard.md
  - _bmad-output/planning-artifacts/architecture.md
---

# agent-orchestrator — BMAD Workflow Dashboard Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the BMAD Workflow Dashboard feature, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can view the current BMAD methodology phase state for a project (Analysis, Planning, Solutioning, Implementation) with each phase showing one of three states: not-started, done, or active
FR2: System can compute phase states from BMAD artifacts on disk using presence-based detection with downstream inference (if a later phase has artifacts, earlier phases are inferred as done)
FR3: User can identify the active phase at a glance through distinct visual indicators for each state (not-started, done, active) that do not rely on color alone
FR4: User can view phase progression as an ordered sequence showing the relationship between phases
FR5: System can generate deterministic recommendations based on artifact state and phase progression, using a rule-based engine with zero LLM dependency
FR6: User can view a contextual recommendation consisting of a state observation and an implication, presented in context voice (factual, no imperative verbs)
FR7: System can produce Tier 1 recommendations (missing phase artifacts) and Tier 2 recommendations (incomplete phases) with structured output (tier, observation, implication, phase)
FR8: System can return null recommendation when no actionable observation applies (all phases complete or no BMAD artifacts present)
FR9: User can view an inventory of all generated BMAD documents with filename, associated phase, document type, file path, and modification timestamp
FR10: System can scan _bmad-output/ directory to discover artifacts and classify them by phase using filename pattern matching
FR11: System can handle unrecognized artifacts by placing them in an uncategorized bucket visible in the inventory but not counted toward phase completion
FR12: User can view the most recent BMAD workflow activity showing filename, phase, and relative timestamp
FR13: User can view a list of available BMAD agents with display name, title, icon, and role description
FR14: System can read agent information from the BMAD agent manifest file (_bmad/_config/agent-manifest.csv)
FR15: System can display an appropriate empty state when the agent manifest file is not found
FR16: System can detect file changes in BMAD-related directories and notify the dashboard within 500ms end-to-end
FR17: User can see the dashboard update automatically when BMAD files are created, modified, or deleted without manual page refresh
FR18: System can debounce rapid file changes to prevent UI flicker during active file editing
FR19: User can navigate to the Workflow tab from the existing dashboard navigation bar
FR20: User can select a project to view its BMAD workflow state
FR21: User can view all workflow panels (phase bar, AI Guide, agents, artifacts, last activity) simultaneously without scrolling at 1280x800 viewport
FR22: User can see an informative empty state when viewing a project with no BMAD configuration (_bmad/ directory absent), explaining what the Workflow tab offers and how to get started
FR23: System can detect whether a project has BMAD configuration and render the appropriate view (full dashboard or empty state)
FR24: System can maintain a last-known-good state for each data source, displaying previous valid data when current data is malformed or unreadable
FR25: System can detect and handle malformed files (truncated YAML, invalid frontmatter, partial content) without producing user-visible errors
FR26: System can handle inaccessible files (permission denied, mid-write) by retaining previous state silently
FR27: System can operate with partial BMAD configurations — each panel independently checks its data source and renders what's available
FR28: System shall NOT write to any file in _bmad/ or _bmad-output/ directories (read-only lens)
FR29: System shall NOT import from or share state with the tracker-bmad plugin or Sprint Board components
FR30: System shall NOT require changes to agent-orchestrator.yaml configuration — auto-detect BMAD presence from file system conventions
FR31: System shall return a consistent API response shape regardless of BMAD state (nullable fields for absent data, never error responses for expected states)

### NonFunctional Requirements

NFR-P1: API response time <100ms for GET /api/workflow/[project] (expected <20ms)
NFR-P2: Page initial render <500ms from navigation to fully rendered Workflow tab
NFR-P3: SSE end-to-end latency <500ms from file change on disk to UI update in browser
NFR-P4: SSE dispatch latency <50ms from debounce timer firing to SSE event sent
NFR-P5: Bundle size <50KB total for all new Workflow components
NFR-P6: Zero new dependencies — 0 new entries in package.json
NFR-P7: Sprint Board performance — zero degradation in existing response times and render performance
NFR-R1: Error resilience coverage — zero user-visible errors across 6 file states x 5 panels = 30 scenarios
NFR-R2: API stability — API always returns HTTP 200 with well-formed JSON for any BMAD state
NFR-R3: File change debounce — 200ms debounce on file system events
NFR-R4: Graceful degradation — each panel renders independently, failure in one does not affect others
NFR-R5: SSE reconnection — client automatically reconnects on connection drop with no user action
NFR-A1: WCAG 2.1 AA compliance for all new Workflow components
NFR-A2: Semantic markup — all panels use semantic HTML elements, no div-soup
NFR-A3: Color independence — all status indicators use labels + icons + color, never color alone
NFR-A4: Keyboard navigation — all interactive elements reachable via keyboard, no keyboard traps
NFR-A5: Screen reader support — ARIA labels on all status indicators with descriptive state information
NFR-A6: Focus visibility — visible focus indicators on all interactive elements
NFR-M1: Component isolation — each panel renderable and testable independently with mock data
NFR-M2: Artifact mapping updatability — mapping defined as single constant, updatable without logic changes
NFR-M3: API contract stability — WorkflowResponse interface documented, changes are breaking changes
NFR-M4: Code isolation from Sprint Board — zero imports from tracker-bmad, zero shared state
NFR-T1: Recommendation engine coverage >80% for recommendation-engine.ts
NFR-T2: Phase computation coverage — all 81 phase-state permutations covered by unit tests
NFR-T3: Component test coverage >70% for all Workflow components
NFR-T4: Integration test fixture — use actual _bmad/ directory as real-world test fixture
NFR-T5: File state test matrix — explicit test cases for all 6 file states

### Additional Requirements

From Architecture (Workflow Dashboard Feature Architecture section):

- Phase computation uses downstream inference algorithm with latest-active-phase selection (WD-1)
- Artifact-to-phase mapping uses ordered ARTIFACT_RULES constant with first-match-wins (WD-2)
- Recommendation engine uses 7-rule ordered chain: R1 (no artifacts), R2 (no brief), R3 (no PRD), R4 (no architecture), R5 (no epics), R6 (implementation active), R7 (all complete → null) (WD-3)
- API always returns HTTP 200 with WorkflowResponse interface — contract frozen after PR 1 (WD-4)
- SSE integration via file watcher singleton (prefer node:fs.watch over chokidar) with 200ms debounce, notification-only events on existing SSE channel (WD-5)
- 5 independent panel components with props-only data flow, CSS Grid layout at 1280x800 (WD-6)
- Three-layer LKG state pattern: file reading → API cache → client state retention (WD-7)
- File scanning covers planning-artifacts/, research/ subdirectory, implementation-artifacts/, and agent-manifest.csv (WD-8)
- Gap WD-G1: Prefer node:fs.watch() with manual debounce over chokidar to avoid dependency risk
- Gap WD-G2: Agent manifest CSV parsing needs quoted-field handling (~20 lines, no external library)
- No starter template — this is additive brownfield, building on existing Next.js patterns
- PR decomposition: PR1 (API+compute+tests), PR2 (page+shell+phase bar), PR3 (AI Guide+agents), PR4 (inventory+activity), PR5 (SSE watcher)
- Import boundaries: lib/workflow/* cannot import from @composio/ao-core, Sprint Board, or tracker-bmad
- All Workflow components prefixed with "Workflow" (e.g., WorkflowPhaseBar.tsx)

### FR Coverage Map

| Requirement | Epic | Stories |
|-------------|------|---------|
| FR1 | Epic 1 | 1.1, 1.5 |
| FR2 | Epic 1 | 1.1, 1.3 |
| FR3 | Epic 1 | 1.5 |
| FR4 | Epic 1 | 1.1, 1.5 |
| FR5 | Epic 2 | 2.1, 2.2 |
| FR6 | Epic 2 | 2.3 |
| FR7 | Epic 2 | 2.1, 2.2 |
| FR8 | Epic 2 | 2.1, 2.2 |
| FR9 | Epic 3 | 3.1 |
| FR10 | Epic 1 | 1.1, 1.3 |
| FR11 | Epic 3 | 3.1 |
| FR12 | Epic 3 | 3.2 |
| FR13 | Epic 2 | 2.4 |
| FR14 | Epic 2 | 2.4 |
| FR15 | Epic 2 | 2.4 |
| FR16 | Epic 4 | 4.1 |
| FR17 | Epic 4 | 4.1, 4.2 |
| FR18 | Epic 4 | 4.1 |
| FR19 | Epic 1 | 1.4 |
| FR20 | Epic 1 | 1.4 |
| FR21 | Epic 1 | 1.4 |
| FR22 | Epic 1 | 1.4 |
| FR23 | Epic 1 | 1.2, 1.4 |
| FR24 | Epic 4 | 4.3, 4.4 |
| FR25 | Epic 4 | 4.3, 4.4 |
| FR26 | Epic 4 | 4.3, 4.4 |
| FR27 | Epic 4 | 4.3, 4.4 |
| FR28 | Epic 1 | 1.1, 1.2 |
| FR29 | Epic 1 | 1.1 |
| FR30 | Epic 1 | 1.1 |
| FR31 | Epic 1 | 1.2 |

## Epic List

### Epic 1: Workflow Phase Visibility
**Goal:** Deliver the foundational Workflow tab with project selection, phase computation engine, phase bar visualization, and the page shell — enabling users to see at a glance which BMAD phase a project is in.
**FRs:** FR1, FR2, FR3, FR4, FR10, FR19, FR20, FR21, FR22, FR23, FR28, FR29, FR30, FR31
**NFRs:** NFR-P1, NFR-P2, NFR-P5, NFR-P6, NFR-P7, NFR-R2, NFR-A1–A6, NFR-M1–M4, NFR-T2, NFR-T4
**Architecture:** WD-1 (Phase Computation), WD-2 (Artifact Mapping), WD-4 (API Design), WD-6 (Component Architecture), WD-8 (File Scanning)
**PR Alignment:** PR1 (API + compute + tests) + PR2 (page + shell + phase bar)

---

### Story 1.1: Artifact Scanner & Phase Computation Engine

As a developer,
I want a library that scans `_bmad-output/` for artifacts, classifies them by phase using ARTIFACT_RULES, and computes phase states via downstream inference,
So that the API has a reliable computation layer to determine BMAD phase progression.

**Acceptance Criteria:**

**Given** a project directory with `_bmad-output/planning-artifacts/` containing files matching known patterns (e.g., `*prd*`, `*architecture*`)
**When** the scanner runs against that directory
**Then** it returns artifacts classified by phase (analysis, planning, solutioning, implementation) with filename, phase, file path, document type, and modification timestamp
**And** unrecognized files are placed in an "uncategorized" bucket

**Given** classified artifacts indicate presence in solutioning phase but not analysis
**When** phase states are computed
**Then** analysis and planning are "done" (downstream inference), solutioning is "active", implementation is "not-started"

**Given** no artifacts exist in `_bmad-output/`
**When** phase states are computed
**Then** all four phases return "not-started"

**Given** artifacts exist in all four phases
**When** phase states are computed
**Then** analysis, planning, solutioning are "done" and implementation is "active" (implementation can never be inferred "done")

**Given** ARTIFACT_RULES is defined as an ordered constant with first-match-wins semantics
**When** a filename matches multiple patterns
**Then** only the first matching rule determines the phase classification

**Requirements:** FR1, FR2, FR4, FR10, FR28, FR29, FR30
**NFRs:** NFR-M2, NFR-M4, NFR-T2, NFR-T4

---

### Story 1.2: Workflow API Route

As a dashboard user,
I want a `GET /api/workflow/[project]` endpoint that returns the complete workflow state for a project,
So that the frontend can render all workflow panels from a single API call.

**Acceptance Criteria:**

**Given** a valid project ID for a project with BMAD artifacts
**When** `GET /api/workflow/[project]` is called
**Then** it returns HTTP 200 with a `WorkflowResponse` JSON body containing `phases`, `recommendation`, `artifacts`, `agents`, `lastActivity` fields

**Given** a valid project ID for a project with no `_bmad/` directory
**When** the endpoint is called
**Then** it returns HTTP 200 with `hasBmad: false` and all data fields as null

**Given** an unknown project ID
**When** the endpoint is called
**Then** it returns HTTP 404 with `{ error: "Project not found" }`

**Given** a project with malformed artifact files (truncated YAML, permission denied)
**When** the endpoint is called
**Then** it returns HTTP 200 with gracefully degraded data (valid fields populated, problematic fields as null or last-known-good)
**And** no error is surfaced to the client

**Given** any valid BMAD state (no artifacts, partial, complete, malformed)
**When** the endpoint is called
**Then** response time is <100ms
**And** the response shape matches the frozen `WorkflowResponse` interface exactly

**Requirements:** FR23, FR31, FR28
**NFRs:** NFR-P1, NFR-R2, NFR-M3

---

### Story 1.3: Phase Computation Unit Tests

As a developer,
I want comprehensive unit tests covering the phase computation engine and artifact scanner,
So that all 81 phase-state permutations and edge cases are verified before building the UI.

**Acceptance Criteria:**

**Given** the phase computation function
**When** the test suite runs
**Then** all 81 permutations of 4 phases × 3 states are covered with explicit test cases

**Given** the artifact scanner
**When** tested against the project's actual `_bmad/` directory as a fixture
**Then** it correctly classifies real BMAD artifacts by phase

**Given** the ARTIFACT_RULES constant
**When** tested with edge cases (unknown files, no extension, dotfiles)
**Then** unmatched files are classified as "uncategorized"

**Given** 6 file states (normal, empty, truncated YAML, invalid frontmatter, permission denied, mid-write)
**When** the scanner encounters each state
**Then** it handles gracefully without throwing, returning appropriate defaults

**Requirements:** FR2, FR10, FR11
**NFRs:** NFR-T2, NFR-T4, NFR-T5

---

### Story 1.4: Workflow Page Shell & Navigation

As a dashboard user,
I want a Workflow tab in the navigation bar that opens a page with project selection and a CSS Grid layout shell,
So that I can navigate to the workflow view and select a project to inspect.

**Acceptance Criteria:**

**Given** the dashboard navigation bar
**When** a user views any page
**Then** a "Workflow" tab appears in the nav items

**Given** the user clicks the Workflow tab
**When** the page loads
**Then** a project selector is displayed with all configured projects
**And** initial render completes in <500ms

**Given** no project is selected
**When** the page loads
**Then** the user sees a prompt to select a project (or the first project is auto-selected if only one exists)

**Given** a project with no `_bmad/` directory is selected
**When** the page renders
**Then** an informative empty state is displayed explaining what the Workflow tab offers and how to get started with BMAD

**Given** a viewport of 1280×800
**When** a BMAD-enabled project is selected
**Then** the CSS Grid layout shell renders with placeholder slots for all 5 panels (PhaseBar, AIGuide, Agents, ArtifactInventory, LastActivity) visible without scrolling

**Requirements:** FR19, FR20, FR21, FR22, FR23
**NFRs:** NFR-P2, NFR-P5, NFR-A1–A6

---

### Story 1.5: Phase Bar Component

As a dashboard user,
I want a visual phase progression bar showing the four BMAD phases with distinct state indicators,
So that I can identify the active phase at a glance.

**Acceptance Criteria:**

**Given** phase states returned from the API (e.g., analysis=done, planning=done, solutioning=active, implementation=not-started)
**When** the WorkflowPhaseBar component renders
**Then** it displays four phases in order (Analysis → Planning → Solutioning → Implementation) with visual indicators: ○ for not-started, ● for done, ★ for active

**Given** the component renders
**When** viewed by a user who cannot perceive color
**Then** each state is distinguishable by icon/symbol and label, not color alone

**Given** the component renders
**When** inspected for accessibility
**Then** it uses semantic HTML, has ARIA labels with descriptive state information (e.g., "Analysis phase: completed"), and all indicators have visible focus rings

**Given** phase data is null (API returned degraded response)
**When** the component renders
**Then** it shows a graceful loading/empty state rather than crashing

**Requirements:** FR1, FR3, FR4
**NFRs:** NFR-A1–A6, NFR-M1, NFR-P5

---

### Epic 2: AI-Guided Recommendations & Agent Discovery
**Goal:** Add the AI Guide panel with deterministic recommendations and the Agents panel showing available BMAD agents — giving users contextual next-step guidance and awareness of the agent team.
**FRs:** FR5, FR6, FR7, FR8, FR13, FR14, FR15
**NFRs:** NFR-T1, NFR-M1, NFR-A1–A6
**Architecture:** WD-3 (Recommendation Engine), WD-6 (Component Architecture)
**PR Alignment:** PR3 (AI Guide + agents)

---

### Story 2.1: Recommendation Engine

As a developer,
I want a deterministic rule-based recommendation engine that evaluates artifact state and returns contextual guidance,
So that the AI Guide panel can display next-step recommendations with zero LLM dependency.

**Acceptance Criteria:**

**Given** a project with no BMAD artifacts at all
**When** the recommendation engine runs
**Then** it returns a Tier 1 recommendation: R1 (observation: "No BMAD artifacts detected", implication about starting with analysis)

**Given** a project missing a product brief but having later-phase artifacts
**When** the engine runs
**Then** it returns Tier 1: R2 (missing brief observation + implication about foundational analysis)

**Given** a project missing PRD, architecture, or epics (R3, R4, R5 respectively)
**When** the engine runs with those gaps
**Then** it returns the first matching rule's recommendation with correct tier, observation, implication, and phase

**Given** a project with implementation as the active phase
**When** the engine runs
**Then** it returns Tier 2: R6 (implementation active observation + implication)

**Given** a project with all phases complete (artifacts in all four)
**When** the engine runs
**Then** it returns null (R7 — no actionable recommendation)

**Given** the 7-rule chain
**When** multiple rules could match
**Then** only the first matching rule fires (ordered chain, first-match-wins)

**Given** any recommendation output
**When** the observation and implication text is reviewed
**Then** it uses context voice (factual statements, no imperative verbs like "you should" or "please create")

**Requirements:** FR5, FR7, FR8
**NFRs:** NFR-T1

---

### Story 2.2: Recommendation Engine Tests

As a developer,
I want thorough unit tests for the recommendation engine covering all 7 rules, edge cases, and output format,
So that recommendation logic is verified before wiring to the UI.

**Acceptance Criteria:**

**Given** the recommendation engine
**When** the test suite runs
**Then** each of the 7 rules (R1–R7) has at least one dedicated test case verifying its trigger condition, output tier, observation, implication, and phase

**Given** R7 (null recommendation)
**When** tested
**Then** the function returns null, not an empty object or undefined

**Given** the rule chain ordering
**When** tested with states that could match multiple rules
**Then** only the first matching rule's recommendation is returned

**Given** all recommendation outputs
**When** tested
**Then** each has the structured shape: `{ tier: 1|2, observation: string, implication: string, phase: Phase }`

**Given** recommendation text content
**When** tested against context voice rules
**Then** no observation or implication contains imperative verbs

**Requirements:** FR5, FR7, FR8
**NFRs:** NFR-T1

---

### Story 2.3: AI Guide Panel Component

As a dashboard user,
I want an AI Guide panel that displays the current recommendation with its observation and implication,
So that I can understand what to do next in my BMAD workflow.

**Acceptance Criteria:**

**Given** the API returns a non-null recommendation
**When** the WorkflowAIGuide component renders
**Then** it displays the observation and implication text, visually distinguished, with the recommendation tier indicated

**Given** the API returns a null recommendation (all phases complete or no artifacts)
**When** the component renders
**Then** it displays an appropriate message (e.g., "All phases complete" or contextual empty state)

**Given** the component renders
**When** inspected for accessibility
**Then** it uses semantic HTML (e.g., `<section>`, `<p>`), has appropriate ARIA labels, and is keyboard-navigable

**Given** the recommendation data is loading or unavailable
**When** the component renders
**Then** it shows a loading skeleton or retains the previous recommendation gracefully

**Requirements:** FR6
**NFRs:** NFR-A1–A6, NFR-M1, NFR-P5

---

### Story 2.4: Agent Manifest Parser & Agents Panel

As a dashboard user,
I want to see a list of available BMAD agents with their display name, title, icon, and role description,
So that I understand who the BMAD agent team is and what each agent does.

**Acceptance Criteria:**

**Given** a project with `_bmad/_config/agent-manifest.csv` present
**When** the agents data is loaded
**Then** the CSV is parsed correctly, including quoted fields containing commas, returning agent display name, title, icon, and role description

**Given** the parsed agent data
**When** the WorkflowAgentsPanel component renders
**Then** it displays each agent as a card/row with name, title, icon, and description

**Given** the agent manifest file is not found
**When** the component renders
**Then** it displays an appropriate empty state (e.g., "No agent manifest found") without errors

**Given** the agent manifest CSV contains malformed rows
**When** the parser encounters them
**Then** it skips invalid rows and renders what's available, logging no user-visible errors

**Given** the component renders
**When** inspected for accessibility
**Then** it uses semantic list markup, ARIA labels, and is keyboard-navigable

**Requirements:** FR13, FR14, FR15
**NFRs:** NFR-A1–A6, NFR-M1, NFR-P6

---

### Epic 3: Artifact Inventory & Activity Tracking
**Goal:** Add the Artifact Inventory panel and Last Activity indicator — giving users a complete view of all generated BMAD documents and the most recent workflow activity.
**FRs:** FR9, FR11, FR12
**NFRs:** NFR-M1, NFR-M2, NFR-A1–A6, NFR-T3
**Architecture:** WD-6 (Component Architecture), WD-8 (File Scanning)
**PR Alignment:** PR4 (inventory + activity)

---

### Story 3.1: Artifact Inventory Panel

As a dashboard user,
I want to view an inventory of all generated BMAD documents showing filename, phase, document type, file path, and modification timestamp,
So that I have a complete picture of what artifacts exist in my project.

**Acceptance Criteria:**

**Given** a project with multiple artifacts across phases (e.g., brief in analysis, PRD in planning, architecture in solutioning)
**When** the WorkflowArtifactInventory component renders
**Then** it displays each artifact with filename, associated phase, document type, file path, and modification timestamp

**Given** the artifact list includes unrecognized files (not matching any ARTIFACT_RULES pattern)
**When** the component renders
**Then** unrecognized artifacts appear in an "Uncategorized" section, visible but visually distinguished from categorized artifacts

**Given** no artifacts exist in `_bmad-output/`
**When** the component renders
**Then** it displays an empty state (e.g., "No artifacts generated yet")

**Given** the component renders with artifacts
**When** inspected for accessibility
**Then** it uses semantic table or list markup with proper headers, ARIA labels, and is keyboard-navigable

**Given** artifact data is null or loading
**When** the component renders
**Then** it shows a loading skeleton or graceful empty state without crashing

**Requirements:** FR9, FR11
**NFRs:** NFR-A1–A6, NFR-M1, NFR-M2, NFR-T3

---

### Story 3.2: Last Activity Indicator

As a dashboard user,
I want to see the most recent BMAD workflow activity showing filename, phase, and relative timestamp,
So that I can quickly understand when and where the last change occurred.

**Acceptance Criteria:**

**Given** a project with BMAD artifacts that have modification timestamps
**When** the WorkflowLastActivity component renders
**Then** it displays the most recently modified artifact's filename, phase, and a relative timestamp (e.g., "2 minutes ago", "yesterday")

**Given** no artifacts exist
**When** the component renders
**Then** it displays an appropriate empty state (e.g., "No activity yet")

**Given** the relative timestamp
**When** time passes
**Then** the displayed relative time reflects the current moment accurately (updated on re-render, not live-ticking required)

**Given** the component renders
**When** inspected for accessibility
**Then** it uses semantic HTML with ARIA labels describing the activity context, and the timestamp has a `<time>` element with an absolute `datetime` attribute

**Given** activity data is null or loading
**When** the component renders
**Then** it retains previous state or shows a loading indicator gracefully

**Requirements:** FR12
**NFRs:** NFR-A1–A6, NFR-M1, NFR-T3

---

### Epic 4: Real-Time Updates & Error Resilience
**Goal:** Add file system watching with SSE notifications and implement the LKG error resilience pattern across all panels — making the dashboard live-updating and fault-tolerant.
**FRs:** FR16, FR17, FR18, FR24, FR25, FR26, FR27
**NFRs:** NFR-P3, NFR-P4, NFR-R1, NFR-R3, NFR-R4, NFR-R5, NFR-T5
**Architecture:** WD-5 (SSE Integration), WD-7 (LKG State Pattern)
**PR Alignment:** PR5 (SSE watcher)

---

### Story 4.1: File Watcher with Debounced SSE Notifications

As a dashboard user,
I want the system to detect file changes in BMAD-related directories and push notifications via SSE,
So that the dashboard updates automatically without manual page refresh.

**Acceptance Criteria:**

**Given** a project with BMAD directories (`_bmad-output/`, `_bmad/_config/`)
**When** a file is created, modified, or deleted in those directories
**Then** a `workflow-change` SSE event is dispatched to connected clients within 500ms end-to-end

**Given** the file watcher is using `node:fs.watch()` (not chokidar)
**When** initialized
**Then** it watches `_bmad-output/planning-artifacts/`, `_bmad-output/research/`, `_bmad-output/implementation-artifacts/`, and `_bmad/_config/agent-manifest.csv`
**And** zero new dependencies are added to package.json

**Given** rapid file changes occur (e.g., editor auto-save writing multiple times per second)
**When** the watcher detects them
**Then** events are debounced with a 200ms window, dispatching only one SSE event per debounce cycle

**Given** the SSE event is sent
**When** the client receives it
**Then** the event is notification-only (no payload data — client re-fetches the API)
**And** dispatch latency from debounce timer firing to SSE event sent is <50ms

**Given** the file watcher singleton
**When** multiple SSE clients are connected
**Then** all clients receive the notification (fan-out)

**Given** the watcher encounters an error (e.g., watched directory deleted)
**When** the error occurs
**Then** the watcher degrades gracefully without crashing the server, and logs the error internally

**Requirements:** FR16, FR17, FR18
**NFRs:** NFR-P3, NFR-P4, NFR-R3, NFR-P6

---

### Story 4.2: Client-Side SSE Subscription & Auto-Refresh

As a dashboard user,
I want the Workflow page to subscribe to SSE workflow-change events and automatically re-fetch data,
So that I see live updates as BMAD files change on disk.

**Acceptance Criteria:**

**Given** the Workflow page is open with a project selected
**When** a `workflow-change` SSE event is received
**Then** the page re-fetches `GET /api/workflow/[project]` and re-renders all panels with updated data

**Given** the SSE connection drops (network issue, server restart)
**When** the client detects the disconnection
**Then** it automatically reconnects with no user action required

**Given** the page re-fetches after an SSE event
**When** the API responds
**Then** the UI update is smooth with no flash or flicker of content

**Given** the user navigates away from the Workflow page
**When** the page unmounts
**Then** the SSE subscription is cleaned up (EventSource closed, no memory leak)

**Requirements:** FR17
**NFRs:** NFR-R5, NFR-P3

---

### Story 4.3: LKG State Pattern & Error Resilience

As a dashboard user,
I want each panel to retain its last-known-good state when data becomes temporarily unavailable or malformed,
So that I never see error messages or broken UI during transient file system issues.

**Acceptance Criteria:**

**Given** a panel previously rendered valid data
**When** the next API response returns null or malformed data for that panel's data source
**Then** the panel retains and displays its previous valid state silently

**Given** the API cache layer
**When** a file read fails (permission denied, mid-write lock, truncated content)
**Then** the API returns the last-known-good cached value for that data source
**And** no error is included in the HTTP response

**Given** all 5 panels (PhaseBar, AIGuide, Agents, ArtifactInventory, LastActivity)
**When** one panel's data source fails
**Then** only that panel uses LKG state — all other panels render fresh data independently

**Given** the 6 file states × 5 panels matrix (30 scenarios)
**When** each scenario is exercised
**Then** zero user-visible errors are produced across all 30 scenarios

**Given** a project where `_bmad-output/` is temporarily inaccessible (e.g., network mount disconnect)
**When** the API is called
**Then** it returns HTTP 200 with LKG data for all affected fields, maintaining the frozen WorkflowResponse shape

**Requirements:** FR24, FR25, FR26, FR27
**NFRs:** NFR-R1, NFR-R4, NFR-R2

---

### Story 4.4: Error Resilience Tests

As a developer,
I want comprehensive tests covering the LKG state pattern, file watcher debounce, and all 30 error resilience scenarios,
So that the system's fault tolerance is verified before release.

**Acceptance Criteria:**

**Given** the LKG cache layer
**When** tested with sequential calls (valid data → invalid data → valid data)
**Then** the cache returns valid data on the second call and fresh data on the third

**Given** the file watcher debounce
**When** tested with 10 rapid events within 200ms
**Then** only one SSE notification is dispatched

**Given** the 6 file states (normal, empty, truncated YAML, invalid frontmatter, permission denied, mid-write)
**When** tested against each of the 5 data sources
**Then** all 30 scenarios produce graceful results with no thrown exceptions and no error responses

**Given** panel independence
**When** one data source is in an error state and others are normal
**Then** the API response includes LKG for the failed source and fresh data for all others

**Requirements:** FR24, FR25, FR26, FR27
**NFRs:** NFR-R1, NFR-T5
