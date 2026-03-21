---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-03-20-001.md
  - _bmad-output/implementation-artifacts/cycle-4-retrospective.md
  - _bmad-output/planning-artifacts/epics-cycle-5.md
---

# agent-orchestrator - Epic Breakdown (Cycle 6)

## Overview

Cycle 6 covers the remaining brainstorming themes not addressed in Cycles 4-5: accessibility, compound learning, IDE/CI integrations, developer psychology, and deferred collaboration features.

**Scope:** 5 epics, 18 stories.

## Epic List

### Epic 29: Accessibility & Inclusive Design
Dashboard is usable by all — screen readers, high contrast, reduced motion.
**FRs:** Brainstorm #151, #153, #154
**Stories:** 4

### Epic 30: Compound Learning System
Every sprint makes the next one better — cross-sprint patterns, failure analysis, feedback loops.
**FRs:** Brainstorm #43, #50, #56, #176
**Stories:** 4

### Epic 31: IDE & CI Integrations
Orchestration embedded in VS Code and GitHub Actions — no separate dashboard needed.
**FRs:** Brainstorm #123, #125
**Stories:** 3

### Epic 32: Developer Psychology & Engagement
Flow state protection, celebration moments, streak counters — tools that respect human energy.
**FRs:** Brainstorm #201, #204, #206
**Stories:** 3

### Epic 33: Multi-User Collaboration v2
Deferred features from Cycle 5 MVP: shared annotations, role-based ownership, handoff protocol.
**FRs:** Brainstorm #113, #114, #116
**Stories:** 4 (3 deferred + 1 integration)

---

## Epic 29: Accessibility & Inclusive Design

### Story 29.1: Screen Reader-First Agent Status
As a **visually impaired developer**, I want all agent status, notifications, and state changes to have semantic ARIA labels, So that I can orchestrate agents entirely through a screen reader.

**Acceptance Criteria:**
**Given** the dashboard with active agents
**When** accessed by screen reader
**Then** every status indicator has ARIA label (e.g., "Agent 3, story 1-5, status blocked, 45 minutes")
**And** live regions announce state changes automatically

### Story 29.2: High Contrast Mode
As a **color-blind user**, I want status conveyed through shape + pattern (not just color), So that all information is accessible regardless of color perception.

**Acceptance Criteria:**
**Given** the dashboard
**When** high contrast mode is enabled
**Then** status uses shapes: squares=blocked, circles=running, triangles=completed
**And** all color-coded elements have pattern/shape alternatives

### Story 29.3: Reduced Motion Toggle
As a **motion-sensitive user**, I want to disable all animations, So that the dashboard doesn't cause discomfort.

**Acceptance Criteria:**
**Given** the dashboard with animations (pulse, transitions, real-time updates)
**When** reduced motion is toggled (or system `prefers-reduced-motion` is set)
**Then** all animations are replaced with static states
**And** real-time updates use instant transitions instead of smooth animations

### Story 29.4: Accessibility Audit & WCAG Compliance
As a **product owner**, I want the dashboard to pass WCAG 2.1 AA audit, So that we can confidently claim accessibility compliance.

**Acceptance Criteria:**
**Given** the full dashboard
**When** an accessibility audit runs (axe-core or similar)
**Then** zero critical or serious violations
**And** all interactive elements are keyboard-navigable

---

## Epic 30: Compound Learning System

### Story 30.1: Cross-Sprint Pattern Detection
As a **tech lead**, I want the system to identify patterns across sprints, So that recurring issues are surfaced proactively.

**Acceptance Criteria:**
**Given** learning data from 3+ completed sprints
**When** pattern analysis runs
**Then** it identifies: "TypeScript type errors account for 40% of agent failures", "Stories touching auth module take 2x longer"
**And** patterns are ranked by frequency and impact

### Story 30.2: Failure Analysis Knowledge Base
As a **developer**, I want agent failures analyzed and categorized automatically, So that future agents avoid known pitfalls.

**Acceptance Criteria:**
**Given** accumulated session outcomes from the learning store
**When** failure analysis runs
**Then** failures are grouped by: error category, file/module, story complexity
**And** actionable guidance generated: "When working on packages/core/src/types.ts, pay extra attention to type exports"

### Story 30.3: Recommendation Improvement from Feedback
As a **PM**, I want the recommendation engine to improve based on accept/dismiss history, So that suggestions become more relevant over time.

**Acceptance Criteria:**
**Given** JSONL feedback data (from Cycle 5 Story 25a.2)
**When** recommendations are generated
**Then** frequently-dismissed recommendation types are deprioritized
**And** accepted patterns are boosted
**And** improvement is measurable: recommendation acceptance rate should increase over 5 sprints

### Story 30.4: Learning Dashboard Panel
As a **tech lead**, I want a dashboard panel showing learning insights, So that I can see how the system is improving.

**Acceptance Criteria:**
**Given** accumulated learning data
**When** I view the learning panel
**Then** I see: top patterns, acceptance rate trend, most common failure categories
**And** data updates after each sprint completion

---

## Epic 31: IDE & CI Integrations

### Story 31.1: VS Code Extension — Orchestrator Sidebar
As a **developer**, I want a VS Code sidebar showing sprint stories, agent status, and recommendations, So that I never leave the editor.

**Acceptance Criteria:**
**Given** VS Code with the extension installed
**When** I open the sidebar
**Then** I see: current sprint stories, active agents, recommendations
**And** right-click file → "See which agents are modifying this"
**And** Cmd+Shift+P → "Spawn agent for story 1-3"

### Story 31.2: GitHub Action — CI/CD Orchestration
As a **DevOps engineer**, I want a GitHub Action that runs orchestration commands in CI, So that agent management is part of the CI/CD pipeline.

**Acceptance Criteria:**
**Given** `.github/workflows/orchestrate.yml`
**When** the action runs
**Then** it can: spawn agents for new stories, update dashboard on PR events, advance workflow phases on merge

### Story 31.3: Git Hook Integration
As a **developer**, I want git hooks that tag commits with story ID and agent session, So that every commit has full provenance.

**Acceptance Criteria:**
**Given** pre-commit and post-merge hooks
**When** commits are made
**Then** commits are tagged with: story ID, agent session ID, BMAD phase
**And** post-merge updates orchestrator state automatically

---

## Epic 32: Developer Psychology & Engagement

### Story 32.1: Flow State Protector
As a **developer**, I want the system to suppress non-critical notifications when I'm in deep focus, So that my flow state is protected.

**Acceptance Criteria:**
**Given** rapid decisions and activity (deep focus detected)
**When** non-critical notifications arrive
**Then** they are queued instead of pushed
**And** after 30 min of low activity, queued notifications are released
**And** Tier 1 (critical) notifications always break through

### Story 32.2: Celebration Moments
As a **developer**, I want the dashboard to celebrate milestones, So that development feels rewarding.

**Acceptance Criteria:**
**Given** a milestone event (story merged, sprint completed, zero-bug release)
**When** it occurs
**Then** dashboard shows a brief celebration (confetti, sound effect, congratulatory message)
**And** celebrations are configurable (can be disabled)

### Story 32.3: Streak Counter
As a **developer**, I want visible streaks tracking consistent progress, So that I'm motivated to maintain momentum.

**Acceptance Criteria:**
**Given** daily development activity
**When** I view the dashboard
**Then** I see: "5-day streak: at least one story completed every day"
**And** streak breaks are noted but not punishing
**And** milestones celebrated: "10-day streak!"

---

## Epic 33: Multi-User Collaboration v2

### Story 33.1: Shared Annotations on Artifacts
As a **team member**, I want to leave comments on PRDs, architecture docs, and sprint plans, So that collaboration happens in context.

**Acceptance Criteria:**
**Given** any BMAD artifact displayed in dashboard
**When** I click to annotate
**Then** I can leave a comment tied to a specific section
**And** other team members see annotations in real-time

### Story 33.2: Role-Based Agent Ownership
As a **team lead**, I want stories assigned to specific team members whose agents run under their identity, So that there's distributed accountability.

**Acceptance Criteria:**
**Given** a team of 5 developers
**When** stories are assigned
**Then** each member's agents run under their identity
**And** dashboard shows: "R2d2's agents: stories 1-1, 1-3 (2 running)"

### Story 33.3: Handoff Protocol
As a **distributed team member**, I want to hand off agent context to another team member, So that follow-the-sun development works.

**Acceptance Criteria:**
**Given** end of my work day
**When** I click "Hand off to Alex"
**Then** system packages: agent states, pending decisions, context summary, my notes
**And** Alex sees the handoff when they log in

### Story 33.4: Collaboration Integration Test
As a **QA engineer**, I want the full collaboration suite tested end-to-end, So that presence + claims + annotations + handoffs work together.

**Acceptance Criteria:**
**Given** multi-user collaboration features from Cycles 5-6
**When** integration test runs
**Then** simulates: 2 users, team presence, claim review, annotate artifact, handoff
**And** all features work together without conflicts

---

## FR Coverage Map

| FR | Epic |
|----|------|
| #151 Screen Reader | 29.1 |
| #153 High Contrast | 29.2 |
| #154 Reduced Motion | 29.3 |
| WCAG Audit | 29.4 |
| #43 Cross-Sprint Patterns | 30.1 |
| #50 Feedback Improvement | 30.3 |
| #56 Learning Organization | 30.2, 30.4 |
| #176 Compound Learning | 30.1-30.4 |
| #123 VS Code Extension | 31.1 |
| #125 GitHub Action | 31.2 |
| #124 Git Hook Integration | 31.3 |
| #201 Flow State Protector | 32.1 |
| #204 Celebration Moments | 32.2 |
| #206 Streak Counter | 32.3 |
| #113 Shared Annotations | 33.1 |
| #114 Role-Based Ownership | 33.2 |
| #116 Handoff Protocol | 33.3 |

**All FRs mapped. Zero gaps.**
