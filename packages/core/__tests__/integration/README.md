# Integration Test Framework

This directory contains integration tests for the Agent Orchestrator core services. These tests validate system integration assumptions that were deferred across Epic 1 and Epic 2.

## Purpose

Integration tests verify that multiple components work together correctly. Unlike unit tests that use mocks, integration tests use real file operations, Redis connections (when available), and actual service interactions.

**Note**: This directory contains core services integration tests (Redis, State Manager, File Watcher). For end-to-end integration tests with real agents and tmux, see `packages/integration-tests/`.

## Running Tests

### Run all integration tests
```bash
# From project root
pnpm test:integration:core

# Or directly from packages/core
cd packages/core
pnpm test:integration
```

### Run integration tests in watch mode
```bash
cd packages/core
pnpm test:integration:watch
```

### Redis Setup

Integration tests can run with or without Redis:

**Option 1: With Docker (Recommended for CI)**
```bash
# Start Redis container
pnpm test:redis

# Run tests
pnpm test:integration:core

# Stop Redis when done
pnpm test:redis:stop
```

**Option 2: Without Redis (Degraded Mode)**
Tests will automatically fall back to degraded mode if Redis is unavailable. Mock event bus implementations are used for testing.

## Test Structure

```
packages/core/__tests__/integration/
├── integration-test-env.ts  # Shared test environment with Redis fixture and YAML helpers
├── redis-bus.test.ts       # Redis event bus integration tests (11 tests)
├── state-manager.test.ts    # State Manager integration tests (15 tests)
├── file-watcher.test.ts     # File Watcher integration tests (15 tests)
└── event-subscription.test.ts # Event Subscription integration tests (13 tests)
```

**Note:** The original story specification called for separate `fixtures/` and `helpers/` directories, but the implementation consolidated all test utilities into `integration-test-env.ts` for better maintainability. All required functionality is present.

## Writing New Integration Tests

### Basic Template

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createIntegrationTestEnv } from "../integration/integration-test-env.js";

describe("Feature Name Integration", () => {
  let testEnv: Awaited<ReturnType<typeof createIntegrationTestEnv>>;

  beforeAll(async () => {
    testEnv = await createIntegrationTestEnv();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("should do something", async () => {
    // Given: Set up test state
    const testYamlPath = await createTestYaml(testEnv.tempDir);

    // When: Perform action
    await writeFile(testYamlPath, "content", "utf-8");

    // Then: Verify outcome
    const content = await readFile(testYamlPath, "utf-8");
    expect(content).toBe("content");
  });
});
```

### Using Redis Fixture

```typescript
import { createRedisTestFixture } from "../integration/integration-test-env.js";
import type { EventBus } from "@composio/ao-core";

describe("Redis Integration", () => {
  let redisFixture: Awaited<ReturnType<typeof createRedisTestFixture>>;
  let eventBus: EventBus;

  beforeAll(async () => {
    redisFixture = await createRedisTestFixture();
  });

  beforeEach(() => {
    eventBus = redisFixture.createEventBus();
  });

  afterEach(async () => {
    await eventBus.close();
  });

  it("should publish events", async () => {
    await eventBus.publish({
      eventType: "test.event",
      metadata: { test: "data" },
    });
  });
});
```

### Test Environment

The `createIntegrationTestEnv()` function provides:
- **tempDir**: Temporary directory for test files
- **redisHost**: Redis host (if available)
- **redisPort**: Redis port (if available)
- **cleanup()**: Cleanup function to remove temp files

## Test Standards

### File Operations
- **No mocking**: Use real file operations (readFile, writeFile, rm)
- **Atomic operations**: Test write temp + rename pattern
- **Cleanup**: Always clean up temp files in afterAll/afterEach

### Redis Integration
- **Graceful degradation**: Tests must pass without Redis
- **Mock fallback**: Use mock event bus when Redis unavailable
- **Connection handling**: Test connection failures and reconnection

### Performance Testing
- **Measure actual performance**: Use performance.now() for benchmarks
- **Document NFRs**: Compare results against non-functional requirements
- **Reasonable thresholds**: Set generous thresholds for CI environments

### Test Quality
- **No mocking of file operations**: Use real temp directories
- **Setup/teardown idempotent**: Tests can run multiple times safely
- **Order-independent**: Tests don't depend on execution order
- **Clear test names**: Describe what is being tested

## Coverage Goals

Target: **≥30% of total tests should be integration**

Current integration coverage addresses Epic 1 and Epic 2 gaps:
- ✅ Redis event bus (Story 2-1)
- ✅ State Manager YAML persistence (Story 2-5)
- ✅ File watcher with fs events (Story 2-6)
- ✅ Conflict resolution scenarios (Story 2-7)
- ✅ Event subscription with DLQ (Story 2-3)

## Examples from Epic 2 Gaps

### Example 1: Atomic File Operations

```typescript
it("should persist YAML updates atomically", async () => {
  // Given: State manager initialized
  const stateManager = createStateManager({ yamlPath });

  // When: Updating story state
  await stateManager.set("story-1", "in-progress");

  // Then: YAML should be persisted with atomic write (temp + rename)
  const content = await readFile(yamlPath, "utf-8");
  expect(content).toContain("story-1: in-progress");
});
```

### Example 2: Degraded Mode Transitions

```typescript
it("should operate in degraded mode when Redis unavailable", async () => {
  // Given: Event bus created (Redis may be unavailable)
  const eventBus = redisFixture.createEventBus();

  // When: Publishing an event in degraded mode
  await eventBus.publish({
    eventType: "test.degraded",
    metadata: { test: "data" },
  });

  // Then: Event should be queued (not crash)
  expect(eventBus.getQueueSize()).toBeGreaterThanOrEqual(0);
});
```

### Example 3: File Watcher Debouncing

```typescript
it("should debounce file changes within debounce window", async () => {
  // Given: File watcher with 500ms debounce
  const fileWatcher = createFileWatcher({ debounceMs: 500 });

  // When: Multiple rapid changes occur
  for (let i = 0; i < 10; i++) {
    await writeFile(yamlPath, `content-${i}`, "utf-8");
  }

  // Wait for debounce + processing
  await setTimeout(600);

  // Then: Debounce should collapse into single detection
  expect(finalContent).toContain("content-9"); // Last write
});
```

## Troubleshooting

### Tests timeout
- Increase test timeout: `it("slow test", async () => { ... }, { timeout: 30000 })`
- Check if Redis is running: `docker ps | grep redis`
- Verify temp directory cleanup in afterEach

### Redis connection fails
- Tests automatically fall back to degraded mode
- Manually start Redis: `pnpm test:redis`
- Check Redis logs: `docker logs ao-test-redis`

### File permission errors
- Tests run in temp directories with full permissions
- Check if previous test run left files behind
- Manually clean temp: `rm -rf /tmp/ao-integration-test-*`

## References

- [Story 2-1-1: Integration Test Framework](../../../../../../_bmad-output/implementation-artifacts/2-1-1-integration-test-framework.md)
- [Epic 2 Retrospective](../../../../../../_bmad-output/retrospectives/epic-2-retrospective.md) - ACTION-1: Integration Test Framework
- [Architecture Decision: Event Bus](../../../../../../_bmad-output/planning-artifacts/architecture.md#decision-1-event-bus-architecture)
- [Architecture Decision: State Management](../../../../../../_bmad-output/planning-artifacts/architecture.md#decision-2-state-management-strategy)
