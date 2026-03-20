# Agent Orchestrator — Source Tree Analysis

Annotated directory structure of all source code in the monorepo. Updated 2026-03-20.

## Root

```
agent-orchestrator/
├── CLAUDE.md                          # AI coding assistant rules and conventions
├── README.md                          # Project overview with quick start
├── SETUP.md                           # Detailed setup guide
├── SECURITY.md                        # Security policy
├── TROUBLESHOOTING.md                 # Common issues and fixes
├── CHANGELOG.md                       # Release changelog
├── agent-orchestrator.yaml.example    # Config template (YAML + Zod validated)
├── package.json                       # Root workspace config (pnpm 9.15.4)
├── pnpm-workspace.yaml               # Workspace: packages/*, packages/plugins/*
├── tsconfig.base.json                 # Shared TS config (ES2022, Node16, strict)
├── eslint.config.js                   # ESLint flat config (strict + security rules)
├── .github/workflows/
│   ├── ci.yml                         # Lint → Typecheck → Test → Test-Web
│   ├── integration-tests.yml          # Real-binary integration tests
│   ├── onboarding-test.yml            # New contributor validation
│   ├── release.yml                    # Changeset publish to npm
│   └── security.yml                   # Gitleaks, dependency review, npm audit
├── scripts/                           # 22 scripts for agent session management
│   ├── setup.sh                       # Project setup (install deps, build, configure)
│   ├── rebuild-node-pty.js            # Rebuild node-pty native addon
│   ├── try-pr.sh                      # Test PR workflow
│   ├── claude-spawn                   # Spawn Claude Code agent session
│   ├── claude-batch-spawn             # Batch spawn multiple agents
│   ├── claude-spawn-on-branch         # Spawn agent on existing branch
│   ├── claude-spawn-with-context      # Spawn with extra context
│   ├── claude-spawn-with-prompt       # Spawn with custom prompt
│   ├── claude-ao-session              # Start AO orchestrator session
│   ├── claude-session-status          # Check session status
│   ├── claude-status                  # Quick status overview
│   ├── claude-dashboard               # Open dashboard
│   ├── claude-open-all                # Open all sessions in terminal
│   ├── claude-review-check            # Check PR review status
│   ├── claude-bugbot-fix              # Auto-fix bot review comments
│   ├── claude-integrator-session      # Start integrator session
│   ├── claude-splitly-session         # Start splitly session
│   ├── get-claude-session-info        # Extract session metadata
│   ├── send-to-session                # Send message to running session
│   ├── notify-session                 # Send notification about session
│   ├── open-iterm-tab                 # Open iTerm2 tab for session
│   └── open-tmux-session              # Attach to tmux session
└── packages/                          # Monorepo packages (see below)
```

## packages/core/ — @composio/ao-core

Core library: types, config, services, state management. Zero dependencies on cli/web/plugins.

```
packages/core/src/
├── index.ts                           # Barrel export (67 modules)
├── types.ts                           # ALL interfaces: Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, EventBus + 100+ types
├── config.ts                          # YAML config loading + Zod validation + defaults
│
├── ## Session Lifecycle
├── session-manager.ts                 # Session CRUD: spawn, list, get, kill, cleanup, send
├── lifecycle-manager.ts               # State machine + polling loop + reaction engine (18 states)
├── completion-handlers.ts             # On-complete/on-failure handlers with audit + notification
│
├── ## State Management
├── state-manager.ts                   # Write-through cache over sprint-status.yaml
├── file-watcher.ts                    # Chokidar file change detection + cache invalidation
├── sync-service.ts                    # Bidirectional BMAD tracker synchronization
├── sync-bridge.ts                     # Orchestration: StateManager + FileWatcher + SyncService
├── state-conflict-reconciler.ts       # Version conflict detection + retry + escalation
│
├── ## Event System
├── event-publisher.ts                 # Story event publishing with deduplication (5s window)
├── event-subscription.ts              # Pattern-based pub/sub with ack + timeout + retry
├── event-bus-integration.ts           # Trigger evaluation + workflow execution on events
├── audit-trail.ts                     # Append-only JSONL log with SHA-256 integrity + rotation
├── resilient-event-bus.ts             # EventBus wrapper with circuit breaker + retry
├── eventbus-backlog-monitor.ts        # Queue depth alerting
│
├── ## Error Handling & Resilience
├── error-logger.ts                    # Structured logging with secret redaction + error codes
├── circuit-breaker.ts                 # CLOSED/OPEN/HALF_OPEN state machine
├── circuit-breaker-manager.ts         # Named circuit breaker instances per service
├── retry-service.ts                   # Exponential backoff with jitter
├── dead-letter-queue.ts               # Persistent JSONL for failed operations + replay
├── dlq-auto-replay.ts                # Auto-replay on startup
├── dlq-enqueue-bridge.ts             # Bridge: service errors → DLQ
├── dlq-replay-handlers.ts            # Service-specific replay logic
├── resilient-service-wrapper.ts       # Generic circuit breaker + retry wrapper
├── degraded-mode.ts                   # Graceful degradation when services unavailable
│
├── ## Agent Monitoring
├── agent-registry.ts                  # Agent-to-story assignment tracking + zombie detection
├── agent-completion-detector.ts       # Polling-based completion/failure detection
├── blocked-agent-detector.ts          # Inactivity detection with agent-type timeouts
│
├── ## Notifications
├── notification-service.ts            # Queue, dedup, routing, digest mode, DLQ, history
├── notification-adapter.ts            # Priority mapping + format conversion utilities
│
├── ## Health Monitoring
├── health-check.ts                    # Component health checks with configurable thresholds
├── health-check-rules.ts             # Custom rules with weighted scoring
│
├── ## AI Intelligence (Cycle 3)
├── learning-store.ts                  # JSONL knowledge base for session outcomes (90-day retention)
├── session-learning.ts                # Capture structured session outcomes + domain inference
├── learning-patterns.ts               # Failure pattern detection (3+ occurrences → guidance)
├── assignment-scorer.ts               # Agent-story affinity scoring (pluggable scorers)
├── assignment-service.ts              # Smart auto-assignment with dependency resolution
├── collaboration-service.ts           # Cross-agent context sharing + handoff + file conflict prevention
├── dependency-resolver.ts             # Story dependency chains + circular detection (DFS)
├── review-findings-store.ts           # Code review findings JSONL (category, severity, resolution)
├── prompt-builder.ts                  # Multi-layer prompt composition + learning injection
├── burndown-service.ts               # Event-driven sprint burndown recalculation
│
├── ## Conflict Resolution
├── conflict-detection.ts              # Conflict detection service
├── conflict-resolution.ts             # Auto-resolve with priority + tie-breaking strategies
├── conflict-resolver.ts               # Optimistic locking conflict resolution (3 strategies)
├── conflict-metrics.ts                # Conflict tracking metrics
├── conflict-notification.ts           # Conflict → notification integration
├── conflict-patterns.ts               # Conflict pattern analysis
│
├── ## Plugin System
├── plugin-registry.ts                 # Discovery, loading, hot-reload, shutdown lifecycle
├── plugin-loader.ts                   # YAML manifest scanning + validation + permissions
├── plugin-installer.ts               # Plugin installation
├── plugin-marketplace.ts             # Community plugin registry
├── plugin-npm-registry.ts            # npm registry integration
├── plugin-sandbox.ts                 # Plugin isolation sandbox
├── plugin-version-compatibility.ts    # Version compatibility checking
│
├── ## Metadata & Persistence
├── metadata.ts                        # Flat-file key=value read/write (atomic, path-safe)
├── log-capture.ts                     # Tmux pane capture + log file storage
├── paths.ts                           # Hash-based directory structure + path generation
│
├── ## Utilities
├── utils.ts                           # Shell escaping, URL validation, JSONL reading
├── utils/file-lock.ts                # Advisory file locking (proper-lockfile)
├── utils/yaml-merge.ts               # YAML merge utilities
├── tmux.ts                            # Tmux command wrappers
├── service-registry.ts               # Global service singleton lookup
├── config-generator.ts               # Auto-generate config from repo URL (isRepoUrl, parseRepoUrl, detectScmPlatform — GitHub/GitLab/Bitbucket)
├── orchestrator-prompt.ts            # Generate orchestrator context for ao start (injects available commands, session workflows, project config)
├── interface-validation.ts           # Runtime interface method validation + feature flags (prevents phantom method assumptions)
├── trigger-condition-evaluator.ts    # Dynamic trigger condition evaluation (AND/OR/NOT operators, debounce, once-only firing)
└── workflow-engine.ts                # Step-based workflow execution with conditional branching, async queuing, retry logic
```

## packages/cli/ — @composio/ao-cli

CLI tool: the `ao` command. Commander.js with 66 command files (67 registered commands — `spawn.ts` and `start.ts` each register 2; `standup.ts` exists but is not registered) + 15 lib utilities.

```
packages/cli/src/
├── index.ts                           # Entry point: registers all commands with Commander
│
├── commands/                          # 66 command files
│   ├── ## Session Lifecycle
│   ├── init.ts                        # ao init [--auto] [--smart] — setup wizard
│   ├── start.ts                       # ao start [project|url] — start orchestrator + dashboard
│   ├── spawn.ts                       # ao spawn <project> [issue] — spawn agent session
│   ├── spawn-story.ts                # ao spawn --story <id> — spawn with story context
│   ├── session.ts                     # ao session ls|kill|cleanup|restore
│   ├── status.ts                      # ao status [--project] [--story] [--json]
│   ├── send.ts                        # ao send <session> <message>
│   ├── open.ts                        # ao open [session] — open in terminal
│   ├── pause.ts                       # ao pause <agentId> [--resume]
│   ├── resume.ts                      # ao resume <storyId> [--message] — resume blocked story
│   ├── create.ts                      # ao create — create new session
│   │
│   ├── ## Assignment & Agents
│   ├── assign.ts                      # ao assign <story-id> <agent-id> [--force] [--unassign]
│   ├── assign-next.ts                # ao assign-next — auto-assign next ready story
│   ├── assign-suggest.ts             # ao assign-suggest — scored agent recommendations
│   ├── agent.ts                       # ao agent <id> — agent details
│   ├── agent-history.ts              # ao agent-history <id> — learning history
│   │
│   ├── ## Sprint & Story Management
│   ├── sprint.ts                      # ao sprint — sprint overview
│   ├── sprint-start.ts               # ao sprint-start — begin sprint
│   ├── sprint-end.ts                 # ao sprint-end — end sprint
│   ├── sprint-summary.ts            # ao sprint-summary — sprint summary
│   ├── sprint-config.ts             # ao sprint-config — sprint configuration
│   ├── sprint-plan.ts               # ao sprint-plan — sprint planning
│   ├── story.ts                       # ao story <id> — story details
│   ├── stories.ts                     # ao stories — list stories
│   ├── story-status.ts               # ao story-status — story status
│   ├── epic.ts                        # ao epic — epic management
│   ├── move.ts                        # ao move — move story across statuses
│   ├── points.ts                      # ao points — story points
│   │
│   ├── ## Analytics & Monitoring
│   ├── fleet.ts                       # ao fleet — multi-agent fleet matrix
│   ├── metrics.ts                     # ao metrics — project metrics
│   ├── burndown.ts                    # ao burndown — sprint burndown chart
│   ├── velocity.ts                    # ao velocity — velocity trend
│   ├── throughput.ts                 # ao throughput — throughput metrics
│   ├── cfd.ts                         # ao cfd — cumulative flow diagram
│   ├── aging.ts                       # ao aging — story aging analysis
│   ├── compare.ts                     # ao compare — sprint comparison
│   ├── monte-carlo.ts               # ao monte-carlo — forecast simulation
│   ├── workload.ts                    # ao workload — workload distribution
│   ├── standup.ts                     # ao standup — standup report (not registered in index.ts)
│   ├── retro.ts                       # ao retro — sprint retrospective
│   ├── goals.ts                       # ao goals — sprint goals
│   │
│   ├── ## Communication & Notifications
│   ├── notify.ts                      # ao notify — send notification
│   ├── notifications.ts             # ao notifications — notification settings
│   │
│   ├── ## PR & Review
│   ├── review-check.ts               # ao review-check — PR review status
│   ├── review-stats.ts               # ao review-stats — review analytics
│   │
│   ├── ## Debugging & Logs
│   ├── logs.ts                        # ao logs [session] — agent logs
│   ├── errors.ts                      # ao errors — error log
│   ├── events.ts                      # ao events — event audit trail
│   ├── metadata.ts                    # ao metadata — session metadata
│   ├── history.ts                     # ao history — session history
│   │
│   ├── ## System & Infrastructure
│   ├── health.ts                      # ao health — system health + DLQ depth
│   ├── dashboard.ts                   # ao dashboard — open web dashboard
│   ├── dlq.ts                         # ao dlq — dead letter queue
│   ├── plugins.ts                     # ao plugins — plugin management
│   ├── triggers.ts                    # ao triggers — event triggers
│   ├── workflows.ts                   # ao workflows — workflow management
│   ├── sync.ts                        # ao sync — tracker/SCM sync
│   │
│   ├── ## AI Intelligence (Cycle 3)
│   ├── learning-patterns.ts          # ao learning-patterns — failure patterns
│   ├── collab-graph.ts               # ao collab-graph — collaboration visualization
│   │
│   ├── ## Conflict & Dependencies
│   ├── conflicts.ts                   # ao conflicts — list conflicts
│   ├── resolve-conflicts.ts         # ao resolve-conflicts — auto-resolve
│   ├── resolve.ts                     # ao resolve — manual resolve
│   ├── deps.ts                        # ao deps — dependency graph
│   ├── retry.ts                       # ao retry — retry failed ops
│   ├── rework.ts                      # ao rework — rework stories
│   └── plan.ts                        # ao plan — planning view
│
└── lib/                               # 15 shared utilities
    ├── shell.ts                       # execFile wrappers (git, gh, tmux) — NEVER exec
    ├── format.ts                      # Terminal formatting: colors, tables, time, status icons
    ├── plugins.ts                     # Plugin factory: getAgent, getRuntime, getSCM, getTracker
    ├── create-session-manager.ts     # SessionManager factory with registry caching
    ├── resolve-project.ts            # CLI project ID resolution + validation
    ├── session-utils.ts              # Session name matching + project discovery
    ├── preflight.ts                   # Pre-flight checks: port, build, tmux, gh auth
    ├── web-dir.ts                     # Dashboard utilities: port check, browser open
    ├── dashboard-rebuild.ts          # Next.js cache cleanup
    ├── story-context.ts              # Sprint-status.yaml + story file parsing
    ├── resume-context.ts             # Resume flow context formatting
    ├── wire-detection.ts             # Lifecycle event wiring for story-spawned sessions
    ├── project-detection.ts          # Project type detection for ao init --auto
    ├── lifecycle.ts                   # Session lifecycle hooks
    └── chart.ts                       # CLI chart rendering utilities
```

## packages/web/ — @composio/ao-web

Next.js 15 App Router dashboard with real-time SSE, sprint board, workflow visualization.

```
packages/web/
├── e2e/                               # Playwright E2E / screenshot tooling
│   ├── screenshot.ts                  # Screenshot capture script
│   └── lib/
│       ├── browser.ts                 # Browser launch + page management
│       └── server.ts                  # Dev server lifecycle for E2E
├── scripts/
│   └── kill-stale-dev.sh              # Kill orphaned Next.js dev server processes
├── server/                            # WebSocket servers (run alongside Next.js)
│   ├── terminal-websocket.ts          # WebSocket proxy for tmux terminal I/O
│   ├── direct-terminal-ws.ts         # Direct PTY WebSocket for orchestrator terminal
│   └── tmux-utils.ts                 # Tmux helper functions for server
│
└── src/
    ├── app/                           # Next.js App Router pages
    │   ├── layout.tsx                 # Root layout (IBM Plex fonts, AppNav)
    │   ├── page.tsx                   # Home — Sessions/Sprint toggle
    │   ├── fleet/page.tsx             # Fleet monitoring matrix
    │   ├── workflow/page.tsx          # BMAD workflow dashboard
    │   ├── settings/page.tsx          # Configuration & preferences
    │   ├── events/page.tsx            # Event audit trail
    │   ├── conflicts/page.tsx         # Conflict resolution
    │   ├── sessions/[id]/page.tsx     # Session detail (terminal, PR, issue)
    │   ├── dev/terminal-test/page.tsx # Dev-only terminal WebSocket test page
    │   ├── test-direct/page.tsx       # Dev-only direct PTY terminal test page
    │   │
    │   └── api/                       # API routes (55 route files)
    │       ├── sessions/route.ts      # GET /api/sessions — list all sessions
    │       ├── sessions/[id]/route.ts # GET /api/sessions/:id — session detail
    │       ├── sessions/[id]/send/    # POST — send message to session
    │       ├── sessions/[id]/kill/    # POST — kill session
    │       ├── sessions/[id]/restore/ # POST — restore session
    │       ├── sessions/[id]/message/ # POST — send message (alternative)
    │       ├── sessions/[id]/issue/   # GET — session issue info
    │       ├── spawn/route.ts         # POST /api/spawn — spawn new agent
    │       ├── events/route.ts        # GET /api/events — SSE stream
    │       ├── health/route.ts        # GET /api/health — system health
    │       ├── learning/route.ts      # GET /api/learning — learning insights
    │       ├── agent/[id]/route.ts    # GET — agent detail
    │       ├── agent/[id]/activity/   # GET — agent activity feed
    │       ├── agent/[id]/logs/       # GET — agent log output
    │       ├── agent/[id]/resume/     # POST — resume blocked agent
    │       ├── audit/events/route.ts  # GET — audit trail query
    │       ├── audit/events/export/   # GET — audit trail CSV/JSON export
    │       ├── dlq/route.ts           # GET — dead letter queue entries
    │       ├── dlq/[errorId]/retry/   # POST — retry failed DLQ entry
    │       ├── conflicts/route.ts     # GET — conflict list
    │       ├── conflicts/[conflictId]/ # PUT — resolve specific conflict
    │       ├── prs/[id]/merge/        # POST — merge PR
    │       ├── sprint/[project]/      # 31 sprint analytics routes
    │       │   ├── route.ts           # Sprint board state
    │       │   ├── health/            # Sprint health score
    │       │   ├── metrics/           # Cycle time metrics
    │       │   ├── velocity/          # Velocity chart data
    │       │   ├── velocity-comparison/  # Sprint-over-sprint velocity
    │       │   ├── cfd/               # Cumulative flow diagram
    │       │   ├── aging/             # Story aging analysis
    │       │   ├── dependencies/      # Dependency graph
    │       │   ├── dependency-cycles/ # Circular dependency detection
    │       │   ├── forecast/          # Sprint forecasting
    │       │   ├── monte-carlo/       # Monte Carlo simulation
    │       │   ├── throughput/        # Throughput metrics
    │       │   ├── comparison/        # Sprint comparison
    │       │   ├── workload/          # Workload distribution
    │       │   ├── rework/            # Rework tracking
    │       │   ├── standup/           # Standup report
    │       │   ├── goals/             # Sprint goals
    │       │   ├── wip/               # Work-in-progress limits
    │       │   ├── history/           # Sprint history
    │       │   ├── summary/           # Sprint summary stats
    │       │   ├── config/            # Sprint configuration
    │       │   ├── notifications/     # Sprint notifications
    │       │   ├── plan/              # Sprint plan
    │       │   ├── retro/             # Retrospective data
    │       │   ├── epics/             # Epic management
    │       │   ├── issues/            # Issue list
    │       │   ├── conflicts/         # Sprint conflicts
    │       │   ├── story/[id]/        # Story CRUD
    │       │   ├── story/create/      # Story creation
    │       │   └── ceremony/start|end/  # Sprint ceremony endpoints
    │       ├── workflow/[project]/    # Workflow state (BMAD phases)
    │       └── workflow/health-metrics/  # Workflow health metrics
    │
    ├── components/                    # 54 React components
    │   ├── ## Pages & Containers
    │   ├── HomeView.tsx               # Dashboard landing (Sessions + Sprint toggle)
    │   ├── Dashboard.tsx              # Session Kanban (attention zones)
    │   ├── SprintBoard.tsx            # Sprint board with columns + epics
    │   ├── SessionDetail.tsx          # Full session detail page
    │   ├── WorkflowDashboard.tsx      # BMAD workflow grid
    │   ├── WorkflowPage.tsx           # Workflow page wrapper
    │   │
    │   ├── ## Session & Agent Cards
    │   ├── SessionCard.tsx            # Session list item
    │   ├── AgentSessionCard.tsx       # Agent-specific session card
    │   ├── FleetMatrix.tsx            # Multi-agent fleet grid
    │   │
    │   ├── ## Workflow (BMAD)
    │   ├── WorkflowPhaseBar.tsx       # Phase progress indicator
    │   ├── WorkflowAIGuide.tsx        # AI recommendation panel
    │   ├── WorkflowArtifactInventory.tsx  # Artifact list by phase
    │   ├── WorkflowAgentsPanel.tsx    # Agent manifest display
    │   ├── WorkflowLastActivity.tsx   # Latest artifact update
    │   ├── EmptyWorkflowState.tsx     # Zero-state UI
    │   │
    │   ├── ## Charts & Analytics
    │   ├── BurndownChart.tsx          # Sprint burndown
    │   ├── VelocityChart.tsx          # Velocity trend
    │   ├── ThroughputChart.tsx        # Stories/week
    │   ├── CycleTimeChart.tsx         # Cycle time distribution
    │   ├── CfdChart.tsx               # Cumulative flow diagram
    │   ├── MonteCarloChart.tsx        # Forecast visualization
    │   ├── AgingHeatmap.tsx           # Story aging heatmap
    │   ├── ReworkChart.tsx            # Rework analysis
    │   ├── RetrospectiveChart.tsx     # Retro metrics
    │   │
    │   ├── ## Sprint Management
    │   ├── PlanningView.tsx           # Sprint planning interface
    │   ├── CreateStoryForm.tsx        # Story creation form
    │   ├── StoryDetailModal.tsx       # Story detail popup
    │   ├── EpicManager.tsx            # Epic CRUD
    │   ├── EpicProgress.tsx           # Epic completion progress
    │   ├── SprintComparisonTable.tsx  # Sprint-over-sprint comparison
    │   ├── SprintGoalsCard.tsx        # Sprint goals status
    │   ├── SprintSummaryCard.tsx      # Sprint summary stats
    │   │
    │   ├── ## Terminal
    │   ├── Terminal.tsx               # ttyd iframe terminal
    │   ├── DirectTerminal.tsx         # Direct PTY WebSocket terminal
    │   │
    │   ├── ## AI Intelligence (Cycle 3)
    │   ├── LearningInsightsPanel.tsx  # Agent learning patterns
    │   │
    │   ├── ## System & Status
    │   ├── ConnectionStatus.tsx       # SSE connection indicator
    │   ├── HealthIndicators.tsx       # Health status display
    │   ├── DeadLetterQueueViewer.tsx  # DLQ entry viewer + retry
    │   ├── ConflictHistoryTable.tsx   # Conflict history
    │   ├── DependencyGraphView.tsx    # Story dependency graph
    │   ├── NotificationPanel.tsx      # Toast notifications
    │   ├── EventDetailModal.tsx       # Event detail popup with payload inspection
    │   ├── HistorySearchView.tsx      # Sprint history search + filter
    │   ├── MetricsPanel.tsx           # Project metrics overview panel
    │   ├── StoryTimeline.tsx          # Story lifecycle event timeline
    │   ├── TeamWorkloadView.tsx       # Agent workload distribution
    │   ├── WipStatusWidget.tsx        # Work-in-progress status indicator
    │   │
    │   ├── ## Layout & Navigation
    │   ├── AppNav.tsx                 # Root navigation bar (IBM Plex fonts)
    │   ├── Navigation.tsx             # Side navigation menu
    │   ├── DynamicFavicon.tsx         # Favicon state indicator (changes with alerts)
    │   │
    │   ├── ## Indicators & Badges
    │   ├── ActivityDot.tsx            # Pulsing agent activity indicator
    │   ├── AttentionZone.tsx          # Attention-required session grouping
    │   ├── CIBadge.tsx                # CI pipeline status badge
    │   └── PRStatus.tsx               # Pull request status indicator
    │
    ├── hooks/                         # 4 React hooks
    │   ├── useSSEConnection.ts        # SSE subscription + exponential backoff reconnect
    │   ├── useSessionEvents.ts        # Session snapshot subscription
    │   ├── useWorkflowSSE.ts          # Workflow change events
    │   └── useFlashAnimation.ts       # Visual flash on state change
    │
    └── lib/                           # Utilities + workflow engine
        ├── types.ts                   # DashboardSession, DashboardPR, AttentionLevel
        ├── serialize.ts               # Core Session → DashboardSession conversion
        ├── services.ts                # Lazy service singleton (config + registry + SM)
        ├── format.ts                  # Duration, time ago, branch humanization
        ├── cache.ts                   # TTL cache for PR enrichment (5 min)
        ├── validation.ts              # Input validation, shell injection prevention
        ├── cn.ts                      # Tailwind class name helper
        ├── event-filters.ts           # Event filtering/sorting
        ├── activity-icons.ts          # Activity state icon mapping
        ├── project-name.ts            # Project name resolution
        ├── workflow-watcher.ts        # File change detection for BMAD artifacts
        └── workflow/                  # Workflow computation engine
            ├── types.ts               # Phase, WorkflowResponse, ArtifactRule
            ├── compute-state.ts       # Phase state inference (downstream logic)
            ├── scan-artifacts.ts      # Scan _bmad-output/ for artifacts
            ├── artifact-rules.ts      # Glob-based artifact classification
            ├── parse-agents.ts        # Agent manifest CSV parser
            ├── recommendation-engine.ts  # AI guidance generation
            └── lkg-cache.ts           # Last-known-good fallback cache
```

## packages/plugins/ — 20 Plugin Packages

```
packages/plugins/
├── ## Runtime Plugins (2)
├── runtime-tmux/src/index.ts          # Tmux sessions: create, destroy, send, output, metrics
├── runtime-process/src/index.ts       # Child process sessions: spawn, signal, output
│
├── ## Agent Plugins (5)
├── agent-claude-code/src/index.ts     # Claude Code: JSONL activity detection, session info, MCP setup
├── agent-codex/src/                   # Codex CLI: app-server-client.ts + index.ts
├── agent-aider/src/index.ts           # Aider: terminal output activity detection
├── agent-opencode/src/index.ts        # OpenCode: SQLite activity detection
├── agent-glm/src/index.ts             # GLM (Yolo): JSONL activity detection
│
├── ## Workspace Plugins (2)
├── workspace-worktree/src/index.ts    # Git worktree: create, destroy, list, postCreate
├── workspace-clone/src/index.ts       # Full git clone: create, destroy, list
│
├── ## Tracker Plugins (3)
├── tracker-github/src/index.ts        # GitHub Issues via gh CLI
├── tracker-linear/src/index.ts        # Linear via Composio/API SDK
├── tracker-bmad/src/                  # BMAD file-based tracker (27 modules)
│   ├── index.ts                       # Main tracker: Tracker interface impl (sprint-status.yaml + story files)
│   ├── auto-transition.ts            # Auto-transition on PR merge (branch → story mapping, batchWriteStoryStatus)
│   ├── sprint-status-reader.ts       # Sprint YAML parsing (shared reader to avoid circular imports)
│   ├── story-detail.ts              # Story markdown file parsing (frontmatter + body)
│   ├── epic-management.ts           # Epic CRUD (create, update, delete, list, progress tracking)
│   ├── dependencies.ts              # Story dependencies (validateDependencies, computeDependencyGraph)
│   ├── history.ts                    # Sprint history (raw JSONL append/read)
│   ├── history-query.ts             # History filtering: by story, epic, date range, target status
│   ├── velocity-comparison.ts       # Velocity metrics (sprint-over-sprint comparison, average/trend)
│   ├── cycle-time.ts                # Cycle time analysis (lead time, percentile distribution)
│   ├── cfd.ts                        # Cumulative flow diagram (daily snapshots by status)
│   ├── forecast.ts                   # Sprint forecasting (velocity-based completion prediction)
│   ├── monte-carlo.ts               # Monte Carlo simulation (probabilistic sprint completion)
│   ├── throughput.ts                # Throughput metrics (stories completed per week)
│   ├── sprint-health.ts            # Sprint health scoring (weighted multi-factor score)
│   ├── story-aging.ts              # Story aging analysis (time-in-status heatmap)
│   ├── team-workload.ts            # Workload distribution (stories per agent)
│   ├── rework.ts                    # Rework tracking (back-transition detection + metrics)
│   ├── standup.ts                   # Standup report generation (yesterday/today/blockers)
│   ├── retrospective.ts            # Retrospective data (what went well/badly, action items)
│   ├── sprint-goals.ts             # Sprint goals tracking (goal → story mapping)
│   ├── sprint-notifications.ts     # Sprint notifications (deadline warnings, capacity alerts)
│   ├── sprint-comparison.ts        # Sprint comparison (side-by-side sprint metrics)
│   ├── sprint-archive.ts           # Sprint archival (snapshot + history preservation)
│   ├── planning.ts                  # Sprint planning (velocity-based recommendations, dependency ordering)
│   ├── workflow-columns.ts         # Workflow column definitions (customizable board columns)
│   └── bmad-tracker-adapter.ts     # NotificationPlugin adapter (bridges Tracker to notification system)
│
├── ## SCM Plugins (1)
├── scm-github/src/index.ts           # GitHub PRs via gh CLI: detect, state, CI, reviews, merge
│
├── ## Notifier Plugins (4)
├── notifier-desktop/src/index.ts      # macOS notifications (osascript) + optional sound
├── notifier-slack/src/                # Slack webhooks
│   ├── index.ts                       # Notifier interface implementation
│   └── notification-plugin.ts        # NotificationPlugin adapter
├── notifier-webhook/src/             # Generic HTTP webhooks
│   ├── index.ts                       # Notifier interface implementation
│   └── notification-plugin.ts        # NotificationPlugin adapter
├── notifier-composio/src/            # Composio platform integration
│   ├── index.ts                       # Notifier interface implementation
│   └── notification-plugin.ts        # NotificationPlugin adapter
│
├── ## Terminal Plugins (2)
├── terminal-iterm2/src/index.ts       # iTerm2: AppleScript tab management (macOS only)
├── terminal-web/src/index.ts          # Web terminal: URL-based session access
│
└── ## EventBus Plugins (1)
    └── event-bus-redis/src/index.ts   # Redis pub/sub with reconnect + in-memory queue fallback
```

## packages/mobile/ — (excluded from workspace)

React Native mobile app. Excluded from pnpm workspace via `!packages/mobile` in `pnpm-workspace.yaml`. Not built, tested, or published as part of the monorepo. Exists as a prototype/future direction.

```
packages/mobile/src/
├── App.tsx                            # Root component
├── components/                        # AttentionBadge, SessionCard, StatBar
├── context/BackendContext.tsx         # Backend connection context
├── hooks/                            # useSession, useSessions, useSessionNotifications
├── navigation/RootNavigator.tsx      # React Navigation stack
├── notifications/                    # Push notifications + background task
├── screens/                          # Home, SessionDetail, Spawn, Terminal, Settings, Commands, Orchestrator
├── terminal/terminal-html.ts         # WebView-based terminal
└── types/index.ts                    # Shared types
```

## packages/plugin-api/ — @composio/ao-plugin-api

```
packages/plugin-api/src/
└── index.ts                           # Public plugin types: Plugin, PluginContext, Event, Story,
                                       # Agent, Trigger, StoryStatus, AgentStatus, TriggerType,
                                       # Logger, Config, EventEmitter, StateManager, AgentManager
```

## packages/integration-tests/

```
packages/integration-tests/src/
├── helpers/                           # Test utilities
│   ├── event-factory.ts              # Event test data factories
│   ├── polling.ts                    # Polling utilities for async assertions
│   ├── session-factory.ts           # Session test data factories
│   └── tmux.ts                      # Tmux test helpers
│
└── *.integration.test.ts             # 21 integration test files
    ├── agent-{claude-code,codex,aider,opencode}.integration.test.ts
    ├── runtime-{tmux,process}.integration.test.ts
    ├── workspace-{worktree,clone}.integration.test.ts
    ├── tracker-linear.integration.test.ts
    ├── terminal-{iterm2,web}.integration.test.ts
    ├── notifier-{desktop,slack,webhook,composio}.integration.test.ts
    ├── cli-{spawn-send-kill,session-ls,spawn-core-read-new}.integration.test.ts
    ├── metadata-lifecycle.integration.test.ts
    ├── config-metadata-service.integration.test.ts
    └── prompt-delivery.integration.test.ts
```

## Statistics

| Metric | Count |
|--------|-------|
| Source files (.ts/.tsx) | 342 |
| Test files | 415 |
| Total lines of code | ~80,000 |
| Test cases | 3,288+ |
| CLI commands | 66 |
| CLI lib utilities | 15 |
| Web components | 54 |
| Web API routes | 55 |
| Core source files | 70 (67 exported via barrel) |
| Plugins | 20 (across 8 slots) |
