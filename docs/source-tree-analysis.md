# Agent Orchestrator — Source Tree Analysis

Annotated directory structure of all source code in the monorepo.

## Root

```
agent-orchestrator/
├── CLAUDE.md                          # AI coding assistant rules and conventions
├── agent-orchestrator.yaml.example    # Config template (YAML + Zod validated)
├── package.json                       # Root workspace config, shared scripts
├── pnpm-workspace.yaml               # pnpm workspace package declarations
├── tsconfig.json                      # Base TypeScript config (strict, ESM)
├── eslint.config.js                   # Shared ESLint flat config
├── prettier.config.js                 # Code formatting rules
├── vitest.config.ts                   # Test runner config
├── turbo.json                         # Turborepo build pipeline
```

## packages/core/ — @composio/ao-core

Core library: types, config, services, state management. Zero framework dependencies.

```
packages/core/src/
├── types.ts                           # ALL plugin interfaces (Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal)
├── config.ts                          # YAML config loader with Zod validation, ~ expansion
├── index.ts                           # Public API barrel export
├── paths.ts                           # Hash-based directory structure for multi-project isolation
├── metadata.ts                        # Flat key=value metadata file reader/writer
├── utils.ts                           # Shared utility functions
│
├── session-manager.ts                 # Session lifecycle: create, monitor, cleanup, restore
├── state-manager.ts                   # 18-state session state machine with transitions
├── lifecycle-manager.ts               # Plugin lifecycle hooks (onSpawn, onComplete, onError)
├── agent-registry.ts                  # Agent instance tracking and discovery
├── agent-completion-detector.ts       # Detects when agents finish work
├── blocked-agent-detector.ts          # Identifies stuck/blocked agents
├── log-capture.ts                     # Agent output log capture and streaming
├── tmux.ts                            # Direct tmux session management helpers
│
├── event-publisher.ts                 # Publish events to bus with degraded mode fallback
├── event-subscription.ts             # Subscribe to events with retry + exponential backoff
├── event-bus-integration.ts          # EventBus interface implementation coordinator
├── notification-service.ts           # Multi-channel notification delivery
│
├── conflict-resolver.ts              # Conflict detection and resolution orchestrator
├── conflict-detection.ts             # File-level conflict detection algorithms
├── conflict-resolution.ts            # Auto-resolution strategies with priority scoring
├── conflict-metrics.ts               # Conflict frequency and pattern metrics
├── conflict-notification.ts          # Conflict alert delivery
├── conflict-patterns.ts              # Pattern analysis for recurring conflicts
│
├── plugin-loader.ts                  # Plugin discovery and dynamic loading
├── plugin-registry.ts               # Loaded plugin instance registry
├── plugin-installer.ts              # CLI plugin installation with dependency checks
├── plugin-sandbox.ts                # Plugin isolation and error containment
├── plugin-npm-registry.ts           # NPM registry queries for plugins
├── plugin-marketplace.ts            # Plugin marketplace foundation
├── plugin-version-compatibility.ts  # Semver compatibility matrix
├── service-registry.ts              # Core service DI container
│
├── circuit-breaker.ts               # Circuit breaker pattern for external calls
├── dead-letter-queue.ts             # Failed event storage with replay
├── dlq-replay-handlers.ts          # DLQ replay strategies
├── retry-service.ts                 # Exponential backoff retry [1s, 2s, 4s, 8s, 16s, 32s, 60s max]
├── degraded-mode.ts                 # Graceful degradation when services unavailable
├── error-logger.ts                  # Structured error logging with context
├── health-check.ts                  # System health monitoring
├── health-check-rules.ts           # Custom health check rule definitions
│
├── audit-trail.ts                   # JSONL event log with hash verification
├── sync-service.ts                  # Bidirectional state sync
├── file-watcher.ts                  # Filesystem change detection
├── interface-validation.ts          # Runtime interface compliance checks
│
├── config-generator.ts              # Interactive config file generator
├── orchestrator-prompt.ts           # Agent prompt construction
├── prompt-builder.ts                # Dynamic prompt assembly
├── completion-handlers.ts           # Post-completion action handlers
│
├── trigger-condition-evaluator.ts   # Trigger conditions (AND/OR/NOT)
├── workflow-engine.ts               # Multi-step workflow executor
│
├── utils/
│   ├── file-lock.ts                 # Advisory file locking mechanism
│   └── yaml-merge.ts               # YAML config merge utility
│
└── __tests__/                       # 53 test files (unit, integration, performance)
    ├── session-manager.test.ts
    ├── state-manager.test.ts
    ├── conflict-*.test.ts
    ├── event-*.test.ts
    ├── plugin-*.test.ts
    └── ...
```

## packages/cli/ — @composio/ao-cli

The `ao` command-line tool. 58 commands for session management, sprint tracking, metrics.

```
packages/cli/src/
├── index.ts                          # CLI entry point, Commander.js program setup
│
├── commands/                         # 58 CLI commands (one file per command)
│   ├── spawn.ts                     # ao spawn — create agent session
│   ├── start.ts                     # ao start — start orchestrator
│   ├── session.ts                   # ao session — list/show sessions
│   ├── status.ts                    # ao status — orchestrator status
│   ├── fleet.ts                     # ao fleet — multi-agent fleet view
│   ├── dashboard.ts                # ao dashboard — open web dashboard
│   ├── plan.ts                      # ao plan — sprint planning
│   ├── sprint.ts                    # ao sprint — sprint management
│   ├── sprint-plan.ts              # ao sprint-plan — generate sprint plan
│   ├── sprint-start.ts             # ao sprint-start — begin sprint
│   ├── sprint-end.ts               # ao sprint-end — end sprint
│   ├── sprint-summary.ts           # ao sprint-summary — sprint metrics
│   ├── sprint-config.ts            # ao sprint-config — configure sprint
│   ├── story.ts                     # ao story — story management
│   ├── stories.ts                   # ao stories — list stories
│   ├── story-status.ts             # ao story-status — update story status
│   ├── spawn-story.ts              # ao spawn-story — spawn agent for story
│   ├── epic.ts                      # ao epic — epic management
│   ├── goals.ts                     # ao goals — sprint goals
│   ├── points.ts                    # ao points — story point tracking
│   ├── velocity.ts                  # ao velocity — velocity metrics
│   ├── throughput.ts               # ao throughput — throughput metrics
│   ├── health.ts                    # ao health — sprint health
│   ├── aging.ts                     # ao aging — issue aging analysis
│   ├── cfd.ts                       # ao cfd — cumulative flow diagram
│   ├── monte-carlo.ts              # ao monte-carlo — Monte Carlo forecast
│   ├── compare.ts                   # ao compare — sprint comparison
│   ├── history.ts                   # ao history — sprint history
│   ├── rework.ts                    # ao rework — rework metrics
│   ├── workload.ts                  # ao workload — team workload
│   ├── standup.ts                   # ao standup — standup report
│   ├── retro.ts                     # ao retro — retrospective
│   ├── deps.ts                      # ao deps — dependency graph
│   ├── conflicts.ts                # ao conflicts — conflict management
│   ├── resolve-conflicts.ts        # ao resolve-conflicts — resolve conflicts
│   ├── dlq.ts                       # ao dlq — dead letter queue
│   ├── retry.ts                     # ao retry — retry failed events
│   ├── events.ts                    # ao events — event log
│   ├── errors.ts                    # ao errors — error log
│   ├── metrics.ts                   # ao metrics — system metrics
│   ├── notifications.ts            # ao notifications — notification history
│   ├── notify.ts                    # ao notify — send notification
│   ├── plugins.ts                   # ao plugins — plugin management
│   ├── triggers.ts                  # ao triggers — trigger management
│   ├── workflows.ts                # ao workflows — workflow management
│   ├── assign.ts                    # ao assign — assign work
│   ├── move.ts                      # ao move — move issues
│   ├── pause.ts                     # ao pause — pause session
│   ├── resume.ts                    # ao resume — resume session
│   ├── resolve.ts                   # ao resolve — resolve issue
│   ├── review-check.ts             # ao review-check — check PR reviews
│   ├── send.ts                      # ao send — send message to agent
│   ├── open.ts                      # ao open — open in browser
│   ├── sync.ts                      # ao sync — sync state
│   ├── agent.ts                     # ao agent — agent details
│   ├── init.ts                      # ao init — initialize project
│   ├── create.ts                    # ao create — create resources
│   └── metadata.ts                  # ao metadata — view metadata
│
└── lib/                             # CLI support utilities
    ├── create-session-manager.ts    # Session manager factory
    ├── dashboard-rebuild.ts         # Dashboard rebuild trigger
    ├── format.ts                    # CLI output formatting (chalk, ora)
    ├── lifecycle.ts                 # CLI lifecycle hooks
    ├── plugins.ts                   # Plugin loading for CLI
    ├── preflight.ts                 # Pre-execution checks
    ├── project-detection.ts         # Auto-detect project config
    ├── resolve-project.ts           # Resolve project path
    ├── resume-context.ts            # Session resume context builder
    ├── session-utils.ts             # Session helper functions
    ├── shell.ts                     # Shell interaction utilities
    └── web-dir.ts                   # Web dashboard directory resolver
```

## packages/web/ — @composio/ao-web

Next.js 15 App Router dashboard with real-time SSE, 130+ components, 53 API routes.

```
packages/web/src/
├── app/
│   ├── layout.tsx                   # Root layout with fonts, nav, notification panel
│   ├── page.tsx                     # Home page (redirects to dashboard)
│   ├── globals.css                  # Tailwind CSS base styles
│   ├── icon.tsx                     # Dynamic favicon
│   │
│   ├── sessions/page.tsx            # Session list view
│   ├── fleet/page.tsx               # Fleet monitoring matrix
│   ├── dev/page.tsx                 # Developer tools page
│   ├── settings/page.tsx            # Settings page
│   ├── conflicts/page.tsx           # Conflict resolution UI
│   ├── events/page.tsx              # Event audit trail viewer
│   ├── workflow/page.tsx            # Workflow dashboard
│   ├── test-direct/page.tsx         # Direct terminal test
│   │
│   └── api/                         # 53 API routes (Next.js route handlers)
│       ├── sessions/route.ts        # GET /api/sessions
│       ├── sessions/[id]/route.ts   # GET /api/sessions/:id
│       ├── sessions/[id]/kill/      # POST kill session
│       ├── sessions/[id]/restore/   # POST restore session
│       ├── sessions/[id]/send/      # POST send message
│       ├── spawn/route.ts           # POST spawn session
│       ├── events/route.ts          # GET SSE stream
│       ├── agent/[id]/route.ts      # GET agent details
│       ├── agent/[id]/activity/     # GET agent activity
│       ├── audit/events/route.ts    # GET audit log
│       ├── audit/events/export/     # POST export audit
│       ├── conflicts/route.ts       # GET/POST conflicts
│       ├── dlq/route.ts             # GET dead letter queue
│       ├── prs/[id]/merge/          # GET/POST PR merge
│       ├── workflow/[project]/      # GET workflow state
│       ├── workflow/health-metrics/  # GET workflow health
│       └── sprint/[project]/...     # 30+ sprint analytics routes
│
├── components/                      # 52 React components
│   ├── HomeView.tsx                 # Dashboard landing page
│   ├── Dashboard.tsx                # Main metrics dashboard
│   ├── SessionCard.tsx              # Session list item
│   ├── SessionDetail.tsx            # Session detail view
│   ├── AgentSessionCard.tsx         # Agent session rendering
│   ├── SprintBoard.tsx              # Kanban board
│   ├── WorkflowDashboard.tsx        # BMAD workflow dashboard
│   ├── WorkflowPhaseBar.tsx         # Phase progress indicator
│   ├── WorkflowAgentsPanel.tsx      # Active agents grid
│   ├── WorkflowAIGuide.tsx          # AI recommendation display
│   ├── WorkflowArtifactInventory.tsx # Artifact table
│   ├── WorkflowLastActivity.tsx     # Recent artifact update
│   ├── EmptyWorkflowState.tsx       # Zero-state UI
│   ├── BurndownChart.tsx            # Burndown chart
│   ├── VelocityChart.tsx            # Velocity trend
│   ├── CfdChart.tsx                 # Cumulative flow diagram
│   ├── MonteCarloChart.tsx          # Monte Carlo projections
│   ├── Terminal.tsx                 # ttyd iframe terminal
│   ├── DirectTerminal.tsx           # PTY WebSocket terminal
│   ├── ConnectionStatus.tsx         # SSE connection indicator
│   ├── AppNav.tsx                   # Top navigation bar
│   ├── Navigation.tsx               # Sidebar navigation
│   ├── NotificationPanel.tsx        # Toast notifications
│   └── ...                          # 29 more components
│
├── lib/
│   ├── types.ts                     # Dashboard-specific types
│   ├── services.ts                  # API client functions
│   ├── cache.ts                     # Client-side cache
│   ├── format.ts                    # Display formatting
│   ├── cn.ts                        # Tailwind class merger
│   ├── validation.ts               # Form validation
│   ├── serialize.ts                # Data serialization
│   ├── event-filters.ts            # Event stream filtering
│   ├── activity-icons.ts           # Activity type icons
│   ├── project-name.ts             # Project name resolver
│   ├── workflow-watcher.ts          # Workflow file change watcher
│   └── workflow/                    # Workflow Dashboard engine
│       ├── types.ts                 # Workflow types (Phase, Artifact, Recommendation)
│       ├── artifact-scanner.ts      # BMAD artifact discovery and classification
│       ├── recommendation-engine.ts # 7-rule deterministic recommendation chain
│       ├── phase-calculator.ts      # Phase state computation (pending/active/done)
│       ├── lkg-cache.ts             # Last-known-good in-memory cache (WD-7)
│       └── file-watcher.ts          # Artifact file change detection
│
└── __tests__/                       # 34 test files
```

## packages/plugins/ — 20 Plugins Across 8 Slots

```
packages/plugins/
├── runtime-tmux/src/index.ts        # Tmux session create/destroy/list/send
├── runtime-process/src/index.ts     # Node child_process runtime
│
├── agent-claude-code/src/index.ts   # Claude Code agent adapter
├── agent-codex/src/index.ts         # OpenAI Codex agent adapter
├── agent-aider/src/index.ts         # Aider agent adapter
├── agent-opencode/src/index.ts      # OpenCode agent adapter
├── agent-glm/src/index.ts           # GLM agent adapter
│
├── workspace-worktree/src/index.ts  # Git worktree isolation
├── workspace-clone/src/index.ts     # Full clone isolation
│
├── tracker-github/src/index.ts      # GitHub Issues integration
├── tracker-linear/src/index.ts      # Linear integration
├── tracker-bmad/src/index.ts        # BMAD sprint tracker
│
├── scm-github/src/index.ts          # GitHub PR/CI/review lifecycle
│
├── notifier-desktop/src/index.ts    # macOS native notifications
├── notifier-slack/src/index.ts      # Slack webhook notifications
├── notifier-webhook/src/index.ts    # Generic webhook notifications
├── notifier-composio/src/index.ts   # Composio integration
│
├── terminal-iterm2/src/index.ts     # iTerm2 AppleScript automation
├── terminal-web/src/index.ts        # Web-based terminal (ttyd/xterm.js)
│
└── event-bus-redis/src/index.ts     # Redis pub/sub event distribution
```

Each plugin follows the same structure:
```
plugin-name/
├── package.json                     # Dependencies, peer deps on @composio/ao-core
├── tsconfig.json                    # Extends root config
├── src/
│   └── index.ts                     # PluginModule export with manifest + create()
└── __tests__/
    └── index.test.ts                # Plugin unit tests
```

## packages/integration-tests/

```
packages/integration-tests/src/
├── __tests__/                       # 21 integration test files
│   ├── tmux-runtime.integration.test.ts
│   ├── session-lifecycle.integration.test.ts
│   ├── plugin-loading.integration.test.ts
│   └── ...
```

## packages/plugin-api/

```
packages/plugin-api/src/
├── index.ts                         # Re-exports plugin types from core
└── types.ts                         # PluginModule, PluginManifest types
```

## _bmad-output/ — BMAD Methodology Artifacts

```
_bmad-output/
├── planning-artifacts/
│   ├── prd.md                       # Product Requirements Document
│   ├── architecture.md              # Architecture specification
│   ├── ux-design.md                 # UX design specification
│   └── epics/                       # 11 epic specifications
│       ├── epic-1.md through epic-10.md
│       └── epic-2.1.md              # Technical debt resolution
├── stories/                         # 66 story specifications
├── retrospectives/                  # Epic and project retrospectives
├── sprint-status.yaml               # Sprint tracking state
└── project-context.md               # 87 AI coding rules
```
