# Changelog

## [Unreleased] — Planning Cycle 3

### Added
- Performance benchmark tests validating NFR targets (health <200ms, burndown <200ms, log read <50ms, DLQ stats <50ms)
- CLI integration tests for `ao burndown`, `ao logs`, `ao events query` (14 e2e tests)
- API route tests for `/api/health` and `/api/sessions` (10 tests)
- `ao agent-history`, `ao learning-patterns`, `ao assign-suggest`, `ao review-stats`, `ao collab-graph` CLI commands (planned, Epic 11-15)

### Fixed
- CLI `ao health` now consumes `health:` YAML config section (4x deferred item from Cycles 1-2, finally resolved)
- CLI `ao health` displays DLQ depth row when `dlq.jsonl` exists

## [2026-03-18] — Planning Cycle 2 Complete

### Added
- **CLI Commands**: `ao fleet` (htop-style matrix with keyboard navigation), `ao burndown` (ASCII chart), `ao logs` (tail/follow/since), `ao events query` (audit trail viewer)
- **Web Components**: FleetMatrix table component with j/k/Enter keyboard navigation, responsive columns
- **Health API**: `GET /api/health` endpoint (always HTTP 200, WD-FR31 pattern)
- **Health Config**: `health:` section in YAML config with thresholds, perComponent, alertOnTransition
- **DLQ Health Check**: Dead Letter Queue depth monitoring (healthy/degraded/unhealthy)
- **Health Transitions**: `health.status_changed` events published via EventBus on status change
- **Rules Engine Integration**: HealthCheckRulesEngine wired into HealthCheckService (custom checks + weighted aggregation)
- **Metadata Callback**: `onCorruptionDetected` callback on `readMetadata()` for corruption event publishing
- **Classification Rules API**: `registerClassificationRule()` + `clearClassificationRules()` for custom error classification
- **DLQ Enhancements**: FIFO eviction (10K cap), auto-replay on startup (30s timeout), backlog monitor, circuit breaker → DLQ integration
- **Format Utilities**: `parseTimeDelta()`, `formatDuration()`, `formatTimeAgo()`, `getStatusInfo()`, `renderBurndownChart()`

### Changed
- **Default port**: 3000 → 5000 (54 files updated: tests, docs, configs, CLI init command)
- **Fleet page**: Kanban card layout replaced with FleetMatrix table (561 → 103 lines)
- **Fleet sort**: Default sort changed to status-priority (blocked first) instead of agent ID

### Infrastructure
- **Zombie prevention**: `predev` npm hook + `kill-stale-dev.sh` script kills stale dev processes and frees ports 5000/5080/5081 before starting new dev server
- **`--kill-others`**: Added to concurrently in dev script — child processes terminate when any one exits

## [2026-03-15] — Planning Cycle 1 Complete

### Delivered
- 66 stories across 11 epics (all done)
- Full plugin architecture (8 slots), session lifecycle, event bus, sync service
- Web dashboard with Sprint Board, Workflow Dashboard (15 stories, 380+ tests)
- 1,400+ tests, 0 failures
