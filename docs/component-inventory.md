# Agent Orchestrator — Component Inventory

## Component Categories (54 components, 4 hooks, 11 lib utilities, 7 workflow engine modules)

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

### Fleet Monitoring

| Component | File | Description |
|-----------|------|-------------|
| FleetMatrix | FleetMatrix.tsx | Multi-agent fleet status matrix |
| HealthIndicators | HealthIndicators.tsx | System health status indicators |
| MetricsPanel | MetricsPanel.tsx | Key metrics summary panel |

### Analytics Charts (Extended)

| Component | File | Description |
|-----------|------|-------------|
| ThroughputChart | ThroughputChart.tsx | Story throughput over time |
| CycleTimeChart | CycleTimeChart.tsx | Story cycle time distribution |
| AgingHeatmap | AgingHeatmap.tsx | Story aging heatmap |
| ReworkChart | ReworkChart.tsx | Rework analysis chart |
| RetrospectiveChart | RetrospectiveChart.tsx | Sprint retrospective visualization |
| SprintComparisonTable | SprintComparisonTable.tsx | Sprint-over-sprint comparison |
| SprintGoalsCard | SprintGoalsCard.tsx | Sprint goals status card |
| SprintSummaryCard | SprintSummaryCard.tsx | Sprint summary statistics |
| WipStatusWidget | WipStatusWidget.tsx | Work-in-progress status |

### Sprint Management

| Component | File | Description |
|-----------|------|-------------|
| PlanningView | PlanningView.tsx | Sprint planning board |
| CreateStoryForm | CreateStoryForm.tsx | New story creation form |
| StoryDetailModal | StoryDetailModal.tsx | Story detail popup |
| EpicManager | EpicManager.tsx | Epic CRUD management |
| TeamWorkloadView | TeamWorkloadView.tsx | Team workload distribution |
| HistorySearchView | HistorySearchView.tsx | Sprint history search |

### Conflict & DLQ Management

| Component | File | Description |
|-----------|------|-------------|
| ConflictHistoryTable | ConflictHistoryTable.tsx | Conflict resolution history |
| DeadLetterQueueViewer | DeadLetterQueueViewer.tsx | DLQ entry viewer with retry |
| DependencyGraphView | DependencyGraphView.tsx | Story dependency graph |

### AI Intelligence (Cycle 3)

| Component | File | Description |
|-----------|------|-------------|
| LearningInsightsPanel | LearningInsightsPanel.tsx | Agent learning insights and patterns |

### Status Indicators

| Component | File | Description |
|-----------|------|-------------|
| ActivityDot | ActivityDot.tsx | Animated activity indicator dot |
| AttentionZone | AttentionZone.tsx | Color-coded attention zone badge |
| CIBadge | CIBadge.tsx | CI status badge |
| PRStatus | PRStatus.tsx | PR state display |
| DynamicFavicon | DynamicFavicon.tsx | Browser favicon with status |
| EventDetailModal | EventDetailModal.tsx | Event detail popup |

### Custom Hooks

| Hook | File | Description |
|------|------|-------------|
| useSSEConnection | useSSEConnection.ts | SSE subscription with auto-reconnect and exponential backoff |
| useWorkflowSSE | useWorkflowSSE.ts | Workflow change events via SSE |
| useSessionEvents | useSessionEvents.ts | Session lifecycle event subscription |
| useFlashAnimation | useFlashAnimation.ts | UI flash animation on state change |

### Lib Utilities

| Utility | File | Description |
|---------|------|-------------|
| types | types.ts | DashboardSession, DashboardPR, AttentionLevel, DashboardStats type definitions |
| format | format.ts | Date, duration, status formatting |
| serialize | serialize.ts | Core Session → DashboardSession conversion, PR/issue enrichment |
| services | services.ts | Service initialization singleton |
| cache | cache.ts | Client-side data caching |
| cn | cn.ts | Tailwind class name helper |
| validation | validation.ts | Input validation utilities |
| event-filters | event-filters.ts | Event stream filtering |
| activity-icons | activity-icons.ts | Activity state icon mapping |
| project-name | project-name.ts | Project name resolution |
| workflow-watcher | workflow-watcher.ts | File system workflow change detection |

### Workflow Engine (Lib)

| Module | File | Description |
|--------|------|-------------|
| artifact-rules | artifact-rules.ts | BMAD artifact detection rules |
| compute-state | compute-state.ts | Workflow phase computation engine |
| lkg-cache | lkg-cache.ts | Last-known-good state cache |
| parse-agents | parse-agents.ts | Agent manifest parser |
| recommendation-engine | recommendation-engine.ts | AI recommendation generator |
| scan-artifacts | scan-artifacts.ts | Filesystem artifact scanner |
| types | types.ts | Workflow type definitions |

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
