---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/implementation-artifacts/cycles-4-5-6-retrospective.md
---

# agent-orchestrator - Epic Breakdown (Cycle 7)

## Overview

Cycle 7 completes the wiring from Cycles 5-6 logic modules to production-ready features, adds IDE integrations, and improves DX conventions.

**Source:** 10 retro action items from Cycles 4-6 retrospective.

## Epic List

### Epic 34: SDK Package & Production Wiring
Create actual `packages/sdk` workspace, extract public API from sdk-types.ts, publish-ready.
**Stories:** 3

### Epic 35: IDE & CI Production Integrations
Build real VS Code extension, GitHub Action, and git hooks from Cycle 6 specs.
**Stories:** 4

### Epic 36: Collaboration Production Features
Wire annotation UI, role-based ownership, and handoff protocol from Cycle 6 specs.
**Stories:** 3

### Epic 37: DX Conventions & Lint Rules
Dead-button lint rule, test-per-story minimum, "renders in parent" AC convention.
**Stories:** 3

---

## Epic 34: SDK Package & Production Wiring

### Story 34.1: Create packages/sdk Workspace Package
As a **platform developer**, I want a standalone `packages/sdk` npm package, So that external tools can `npm install @composio/ao-sdk`.

**Acceptance Criteria:**
**Given** sdk-types.ts in the web package
**When** the SDK package is created
**Then** `packages/sdk/` exists with its own package.json, tsconfig, and index.ts
**And** types and createOrchestratorSDK() are re-exported from the new package
**And** `pnpm build` builds the SDK package independently

### Story 34.2: SDK Integration Tests
As a **developer**, I want SDK integration tests proving spawn/kill/recommend work against a running orchestrator, So that the SDK contract is validated.

**Acceptance Criteria:**
**Given** a mock orchestrator API
**When** SDK methods are called
**Then** spawn returns sessionId, kill terminates, recommend returns recommendation
**And** tests run in CI without a real orchestrator

### Story 34.3: SDK README & Quickstart
As a **developer**, I want SDK documentation with quickstart, API reference, and 3 usage examples, So that I can integrate in 5 minutes.

**Acceptance Criteria:**
**Given** the SDK package
**When** README.md is created
**Then** it includes: install command, quickstart code, API reference, Slack bot example, GitHub Action example, CLI script example

---

## Epic 35: IDE & CI Production Integrations

### Story 35.1: VS Code Extension Scaffold
As a **developer**, I want a VS Code extension scaffold with sidebar panel and command registration, So that the extension is buildable and installable.

**Acceptance Criteria:**
**Given** VS Code extension API
**When** the extension is scaffolded
**Then** `packages/vscode-extension/` exists with package.json, extension.ts, sidebar webview
**And** `vsce package` produces a .vsix file

### Story 35.2: VS Code Extension — Sprint Sidebar
As a **developer**, I want the VS Code sidebar to show sprint stories and agent status, So that I see orchestration state without leaving the editor.

**Acceptance Criteria:**
**Given** the extension scaffold
**When** the sidebar is opened
**Then** it shows stories from sprint-status.yaml, active agents, and recommendations
**And** data refreshes via polling (SSE in future)

### Story 35.3: GitHub Action — Orchestration Commands
As a **DevOps engineer**, I want a GitHub Action that spawns agents and updates status on PR events, So that orchestration is part of CI/CD.

**Acceptance Criteria:**
**Given** `.github/actions/agent-orchestrator/action.yml`
**When** used in a workflow
**Then** it can: spawn agent for a story, update sprint status on merge, post status comment on PR

### Story 35.4: Git Hook Integration — Commit Tagging
As a **developer**, I want pre-commit hooks that tag commits with story ID and agent session, So that every commit has full provenance.

**Acceptance Criteria:**
**Given** a `.ao/hooks/` directory with hook scripts
**When** a commit is made during an agent session
**Then** the commit message includes `[story:1-3] [agent:ao-session-1]` tags
**And** hooks are installed via `ao init --hooks`

---

## Epic 36: Collaboration Production Features

### Story 36.1: Shared Annotation UI Component
As a **team member**, I want to click on any artifact in the dashboard and leave a comment, So that collaboration happens in context.

**Acceptance Criteria:**
**Given** an artifact displayed in WorkflowArtifactInventory
**When** I click the annotation icon
**Then** a comment input appears inline
**And** submitted comments are stored and visible to other users

### Story 36.2: Role-Based Agent Ownership UI
As a **team lead**, I want a UI showing which team member owns which agents, So that there's distributed accountability.

**Acceptance Criteria:**
**Given** the fleet view
**When** agents are assigned to team members
**Then** each agent shows its owner's avatar and name
**And** filtering by owner is available

### Story 36.3: Handoff Protocol Implementation
As a **distributed team member**, I want a "Hand off" button that packages agent state for another person, So that follow-the-sun development works.

**Acceptance Criteria:**
**Given** active agent sessions
**When** I click "Hand off to [person]"
**Then** system captures: agent states, pending decisions, context summary
**And** recipient sees the handoff package when they log in

---

## Epic 37: DX Conventions & Lint Rules

### Story 37.1: Dead-Button Lint Rule
As a **developer**, I want ESLint to error on `<button>` elements without onClick or disabled, So that dead buttons never ship.

**Acceptance Criteria:**
**Given** a custom ESLint rule or eslint-plugin-jsx-a11y configuration
**When** a `<button>` has no onClick and no disabled attribute
**Then** ESLint reports an error
**And** all existing buttons already comply

### Story 37.2: Test-Per-Story Convention Enforcement
As a **QA engineer**, I want a minimum of 3 tests per story enforced in the story template, So that quality doesn't degrade in later cycles.

**Acceptance Criteria:**
**Given** the BMAD story template
**When** a story is marked done
**Then** the dev-story workflow validates ≥3 test assertions exist
**And** stories without sufficient tests are flagged for review

### Story 37.3: "Renders in Parent" AC Convention
As a **developer**, I want every component story to include "component renders in parent layout" as an AC, So that orphan components don't ship.

**Acceptance Criteria:**
**Given** the BMAD story template
**When** a new component story is created
**Then** the template auto-includes "component is rendered in a parent layout" as a default AC
**And** the create-story workflow adds this for component-type stories

---

## FR Coverage Map

| Retro Item | Epic | Story |
|------------|------|-------|
| 1. SDK package | 34 | 34.1, 34.2, 34.3 |
| 2. VS Code extension | 35 | 35.1, 35.2 |
| 3. GitHub Action | 35 | 35.3 |
| 4. Git hooks | 35 | 35.4 |
| 5. Annotation UI | 36 | 36.1 |
| 6. Role-based ownership | 36 | 36.2 |
| 7. Handoff protocol | 36 | 36.3 |
| 8. Test convention | 37 | 37.2 |
| 9. Dead-button lint | 37 | 37.1 |
| 10. Renders-in-parent AC | 37 | 37.3 |

**All 10 retro action items mapped. Zero gaps.**
