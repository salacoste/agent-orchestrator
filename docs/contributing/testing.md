---
title: Testing Guide
nav_order: 3
parent: Contributing
description: Testing conventions for Agent Orchestrator — unit tests, CLI integration tests, full integration tests, mocking patterns, and shared utilities.
---

# Testing Guide

The project uses **vitest** for all testing — unit, CLI integration, and full integration. This guide covers the conventions, patterns, and shared utilities used across the codebase.

{: .highlight }
> **Run all tests:** `pnpm test` — Run integration tests: `pnpm test:integration`

---

## Test Framework

All packages use [vitest](https://vitest.dev/) as the test framework.

### Commands

| Command | What It Runs |
|---------|-------------|
| `pnpm test` | Unit tests across all packages (excludes web) |
| `pnpm test:integration` | Cross-package integration tests |
| `pnpm test:integration:core` | Core package integration tests |
| `pnpm test:redis` | Start Redis Docker container for event bus tests |
| `pnpm test:redis:stop` | Stop and remove Redis container |

### File Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| `src/**/*.test.ts` | Co-located with source | Unit tests for a specific module |
| `src/__tests__/*.test.ts` | Test directory | Broader test suites |
| `**/*.integration.test.ts` | Integration test dirs | Full integration tests |

### Imports

Every test file imports from vitest:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
```

---

## Unit Testing

Unit tests live alongside source files or in `__tests__/` directories. They test individual functions and classes in isolation using minimal mocking.

### Test Structure

Use nested `describe` blocks to group related behavior, with `beforeEach`/`afterEach` for setup and teardown:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MyService } from "../my-service.js";

describe("MyService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), `ao-test-${randomUUID()}-`));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("register", () => {
    it("should add an agent to the registry", () => {
      const service = new MyService({ dataDir: tempDir });
      service.register("agent-1", { capacity: 5 });

      const agents = service.listAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe("agent-1");
    });

    it("should reject duplicate registrations", () => {
      const service = new MyService({ dataDir: tempDir });
      service.register("agent-1", { capacity: 5 });

      expect(() => service.register("agent-1", { capacity: 3 })).toThrow(
        "already registered",
      );
    });
  });
});
```

### Mocking Patterns

The project prefers **hand-built mock objects** over `vi.mock()`:

```typescript
// GOOD — hand-built mock config (plain object literal)
const mockConfig = {
  dataDir: tempDir,
  maxAgents: 10,
  timeout: 30_000,
};

// GOOD — vi.spyOn for method stubs
const spy = vi.spyOn(console, "log").mockImplementation(() => {});
// ... run code that calls console.log ...
expect(spy).toHaveBeenCalledWith("expected message");
vi.restoreAllMocks();
```

Use `vi.spyOn` for time-dependent tests:

```typescript
describe("circuit breaker timing", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should open after failure threshold", () => {
    const breaker = createCircuitBreaker({ threshold: 3 });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe("open");
  });
});
```

{: .note }
> Prefer `vi.spyOn()` over `vi.mock()` for module mocking. Spy on specific methods to keep tests focused and readable.

### Assertions

Use standard vitest matchers:

```typescript
expect(value).toBe(expected);          // Strict equality
expect(value).toEqual(expected);       // Deep equality
expect(array).toHaveLength(3);         // Array length
expect(array).toContain("item");       // Array contains
expect(value).toBeDefined();           // Not undefined
expect(value).toBeNull();              // Is null
expect(fn).toThrow(/pattern/);         // Throws matching pattern
expect(fn).not.toHaveBeenCalled();     // Was never called
```

---

## CLI Integration Testing

CLI integration tests run the `ao` command as a subprocess and validate exit codes, stdout, and stderr. Helpers are in `packages/cli/__tests__/integration/helpers/`.

### Test Helpers

| Helper | File | Purpose |
|--------|------|---------|
| `runCliWithTsx` | `cli-test.ts` | Run `ao` via tsx (no build needed), returns `{ exitCode, stdout, stderr }` |
| `createTempEnv` | `temp-env.ts` | Create temp dir with config, sessions, sprint-status; returns `{ cwd, cleanup }` |

### Writing a CLI Test

```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../helpers/cli-test.js";
import { createTempEnv } from "../helpers/temp-env.js";

describe("ao status", () => {
  it("should show status for running session", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["status"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No active sessions");
    } finally {
      env.cleanup();
    }
  });

  it("should fail without config file", async () => {
    const result = await runCliWithTsx(["status"], { cwd: "/tmp/empty" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No agent-orchestrator.yaml");
  });
});
```

{: .warning }
> Always use `try/finally` for cleanup — never skip it. Temp directories accumulate if cleanup fails, and can cause subsequent test runs to fail.

### Key Conventions

- **Always use `runCliWithTsx`** for development — no build step required
- **Always validate exit codes** — `expect(result.exitCode).toBe(0)` for success, `.toBe(1)` for errors
- **Always use `createTempEnv`** for filesystem isolation — never write to the project directory
- **Always clean up in `finally`** — not `afterEach` (temp env is per-test, not per-describe)

---

## Full Integration Testing

Full integration tests in `packages/integration-tests/` run against real external processes (tmux, claude, API servers). They use extended timeouts and automatic prerequisite gating.

### Configuration

Integration tests use a separate vitest config with extended timeouts:

```typescript
// packages/integration-tests/vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 120_000,   // 2 minutes per test
    hookTimeout: 60_000,    // 1 minute per hook
    pool: "forks",          // Separate processes for isolation
    include: ["src/**/*.integration.test.ts"],
  },
});
```

### Prerequisite Gating

Tests detect the local environment and **skip automatically** when prerequisites are missing:

```typescript
import { isTmuxAvailable } from "./helpers/tmux.js";

const tmuxReady = await isTmuxAvailable();

describe.skipIf(!tmuxReady)("tmux runtime", () => {
  it("should create and destroy a tmux session", async () => {
    // This test only runs when tmux is installed
    const handle = await runtime.create(config);
    expect(await runtime.isAlive(handle)).toBe(true);

    await runtime.destroy(handle);
    expect(await runtime.isAlive(handle)).toBe(false);
  });
});
```

### Async Polling Helpers

For tests that wait on external processes, use shared polling utilities:

```typescript
import { sleep, pollUntil, pollUntilEqual } from "./helpers/polling.js";

// Wait until condition is true (with timeout)
const result = await pollUntil(
  async () => await runtime.isAlive(handle),
  { timeout: 30_000, interval: 500 },
);

// Wait until value matches expected
await pollUntilEqual(
  async () => await runtime.getOutput(handle, 1),
  "Build passed",
  { timeout: 30_000, interval: 500 },
);

// Simple delay
await sleep(1000);
```

### Shared Helpers

| Helper | File | Purpose |
|--------|------|---------|
| `isTmuxAvailable` | `tmux.ts` | Check if tmux is installed |
| `killSessionsByPrefix` | `tmux.ts` | Clean up test tmux sessions |
| `createSession` | `tmux.ts` | Create a tmux session for testing |
| `sleep` | `polling.ts` | Simple delay |
| `pollUntil` | `polling.ts` | Poll until async condition is true |
| `pollUntilEqual` | `polling.ts` | Poll until async value matches expected |
| `makeTmuxHandle` | `session-factory.ts` | Build a test RuntimeHandle |
| `makeSession` | `session-factory.ts` | Build a test Session object |

---

## Test Utilities Reference

### CLI Test Helpers (`packages/cli/__tests__/integration/helpers/`)

#### `runCliWithTsx(args, options)`

Run the CLI via tsx (no build step needed).

```typescript
const result = await runCliWithTsx(
  ["status", "--json"],  // CLI arguments
  { cwd: env.cwd },      // Options (cwd, env, timeout)
);
// result.exitCode  — 0 for success, 1 for error
// result.stdout    — standard output
// result.stderr    — standard error
```

#### `createTempEnv()`

Create an isolated temp directory with all required config files.

```typescript
const env = createTempEnv();
// env.cwd           — temp directory path
// env.configPath    — agent-orchestrator.yaml path
// env.sessionsDir   — sessions directory path
// env.sprintStatus  — sprint-status.yaml path
// env.cleanup()     — remove temp directory and all contents

try {
  // ... run tests using env.cwd ...
} finally {
  env.cleanup();
}
```

---

## Coverage

### Expectations

- **CLI commands**: >=80% of commands should have integration tests
- **Core services**: Key business logic should have unit test coverage
- **Bug fixes**: Include a regression test

### Running Coverage

```bash
# Coverage for a specific package
cd packages/core && pnpm vitest run --coverage

# Check which CLI commands have tests
ls packages/cli/__tests__/integration/*.test.ts
```

{: .note }
> Coverage numbers are a guide, not a gate. Focus on testing critical paths and edge cases rather than chasing a percentage.

---

- **Parent** — [Contributing](.)
- **Siblings** — [Development Guide](development/), [Plugin Development](plugin-development/)
- **Reference** — [Architecture Overview](../getting-started/architecture-overview/), [SDK & Integration](../sdk/)
