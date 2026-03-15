# Agent Orchestrator — Component Inventory

## Component Categories (130+ total)

### Page Containers

| Component | File | Description |
|-----------|------|-------------|
| HomeView | HomeView.tsx | Dashboard landing page |
| WorkflowPage | WorkflowPage.tsx | BMAD workflow with project selector |
| Dashboard | Dashboard.tsx | Main metrics dashboard |

### Session Management

| Component | File | Description |
|-----------|------|-------------|
| SessionCard | SessionCard.tsx | Session list item with status, attention zone, PR info |
| SessionDetail | SessionDetail.tsx | Full session detail with PR/CI/review |
| AgentSessionCard | AgentSessionCard.tsx | Agent-specific session rendering |

### Workflow Dashboard (BMAD)

| Component | File | Description |
|-----------|------|-------------|
| WorkflowDashboard | WorkflowDashboard.tsx | Phase bars + artifacts + recommendation |
| WorkflowPhaseBar | WorkflowPhaseBar.tsx | Horizontal phase progress indicator |
| WorkflowAgentsPanel | WorkflowAgentsPanel.tsx | Active agents grid |
| WorkflowAIGuide | WorkflowAIGuide.tsx | AI recommendation display |
| WorkflowArtifactInventory | WorkflowArtifactInventory.tsx | Artifact list with metadata |
| WorkflowLastActivity | WorkflowLastActivity.tsx | Most recent artifact update |
| EmptyWorkflowState | EmptyWorkflowState.tsx | Zero-state UI |

### Sprint & Analytics

| Component | File | Description |
|-----------|------|-------------|
| SprintBoard | SprintBoard.tsx | Kanban board with issue cards |
| BurndownChart | BurndownChart.tsx | Progress vs time chart |
| VelocityChart | VelocityChart.tsx | Team velocity trend |
| CfdChart | CfdChart.tsx | Cumulative flow diagram |
| MonteCarloChart | MonteCarloChart.tsx | Monte Carlo projections |
| EpicProgress | EpicProgress.tsx | Epic completion status |
| StoryTimeline | StoryTimeline.tsx | Story lifecycle timeline |

### Terminal

| Component | File | Description |
|-----------|------|-------------|
| Terminal | Terminal.tsx | ttyd iframe embed |
| DirectTerminal | DirectTerminal.tsx | Direct PTY WebSocket terminal |

### Real-time & Navigation

| Component | File | Description |
|-----------|------|-------------|
| ConnectionStatus | ConnectionStatus.tsx | SSE connection indicator |
| AppNav | AppNav.tsx | Top navigation bar |
| Navigation | Navigation.tsx | Sidebar navigation |
| NotificationPanel | NotificationPanel.tsx | Toast notifications |

### Custom Hooks

| Hook | File | Description |
|------|------|-------------|
| useSSEConnection | useSSEConnection.ts | SSE subscription with auto-reconnect |
| useWorkflowSSE | useWorkflowSSE.ts | Workflow change events |

## Accessibility Patterns

- Semantic HTML (nav, button, form, section, table)
- ARIA attributes on status indicators
- sr-only text for screen readers
- aria-hidden on decorative elements
- Keyboard navigation support

## Design System

- IBM Plex Sans (main) + IBM Plex Mono (code)
- Dark mode with CSS custom properties
- Tailwind CSS 4.0 utility classes
- Color-coded attention zones (merge > respond > review > pending > working > done)
