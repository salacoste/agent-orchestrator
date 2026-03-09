# CLI Test Infrastructure

This directory contains integration tests for the `ao` CLI commands.

## Overview

CLI integration tests verify that commands work end-to-end by:
- Running the actual CLI binary as a subprocess
- Validating exit codes (0 for success, non-zero for errors)
- Checking stdout/stderr output
- Testing with real config files and state

## Quick Start

### Running Tests

```bash
# Run all CLI tests
pnpm test --filter cli

# Run specific test file
pnpm test packages/cli/__tests__/integration/status.test.ts

# Run in watch mode
pnpm test:watch --filter cli
```

### Writing a New CLI Test

```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../integration/helpers/cli-test.js";
import { createTempEnv } from "../integration/helpers/temp-env.js";

describe("ao mycommand", () => {
  it("should show help", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["mycommand", "--help"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
    } finally {
      env.cleanup();
    }
  });

  it("should error with missing config", async () => {
    const result = await runCliWithTsx(["mycommand"], { cwd: "/tmp/empty-dir-test" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No agent-orchestrator.yaml found");
  });
});
```

## Test Helpers

### `runCli(args, options)`

Run the built CLI binary. Requires `pnpm build` first.

```typescript
const result = await runCli(["status", "--json"], { cwd: testDir });
expect(result.exitCode).toBe(0);
```

### `runCliWithTsx(args, options)`

Run CLI using tsx for development. No build required.

```typescript
const result = await runCliWithTsx(["status"], { cwd: testDir });
expect(result.exitCode).toBe(0);
```

### `createTempEnv(options)`

Create a temporary directory with test config.

```typescript
const env = createTempEnv({
  projectName: "my-project",
  projectConfig: { name: "My Project", repo: "org/repo" },
  withSprintStatus: true,
});
try {
  // Run tests in env.cwd
} finally {
  env.cleanup();
}
```

### `createTempSession(sessionsDir, options)`

Create a session metadata file.

```typescript
createTempSession(env.sessionsDir, {
  sessionId: "app-1",
  issueId: "1-1",
  status: "working",
  branch: "feat/test",
});
```

### `createTempStory(storyLocationDir, options)`

Create a story file for testing.

```typescript
createTempStory(env.storyLocationDir, {
  storyId: "1-1-test",
  title: "Test Story",
  status: "ready-for-dev",
});
```

## Test Patterns

### Testing Happy Path

```typescript
it("should execute successfully", async () => {
  const env = createTempEnv();
  try {
    const result = await runCliWithTsx(["command"], { cwd: env.cwd });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("expected output");
  } finally {
    env.cleanup();
  }
});
```

### Testing Error Cases

```typescript
it("should error with missing config", async () => {
  const result = await runCliWithTsx(["command"], { cwd: "/tmp/empty" });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("error message");
});
```

### Testing JSON Output

```typescript
it("should output valid JSON", async () => {
  const env = createTempEnv();
  try {
    const result = await runCliWithTsx(["command", "--json"], { cwd: env.cwd });
    expect(result.exitCode).toBe(0);
    const data = parseCliJson<ExpectedType>(result);
    expect(data).toHaveLength(5);
  } finally {
    env.cleanup();
  }
});
```

### Testing With Session State

```typescript
it("should show sessions", async () => {
  const env = createTempEnv();
  try {
    createTempSession(env.sessionsDir, {
      sessionId: "test-1",
      status: "working",
      branch: "main",
    });

    const result = await runCliWithTsx(["status"], { cwd: env.cwd });
    expect(result.stdout).toContain("test-1");
  } finally {
    env.cleanup();
  }
});
```

## File Structure

```
packages/cli/__tests__/
├── integration/
│   ├── helpers/
│   │   ├── cli-test.ts      # CLI test runner utilities
│   │   └── temp-env.ts      # Temp environment fixtures
│   ├── fixtures/
│   │   └── configs/         # Test YAML configs
│   ├── plan.test.ts         # CLI integration tests
│   ├── spawn.test.ts
│   ├── status.test.ts
│   └── fleet.test.ts
├── commands/                # Existing unit tests
└── CLI_TEST_README.md       # This file
```

## Coverage Goals

Target: ≥80% of CLI commands have integration tests.

Priority commands to test:
1. `ao plan` - Sprint planning (Story 1-1)
2. `ao spawn` - Agent spawning (Story 1-2)
3. `ao status` - Status display (Story 1-4)
4. `ao fleet` - Fleet monitoring (Story 1-8)
5. YAML file watcher (Story 2-6 - was deferred)
6. Conflict resolution (Story 2-7 - was deferred)

## Conventions

- Use `runCliWithTsx` for development (no build step)
- Use `createTempEnv` for test isolation
- Always cleanup temp environments in `finally` blocks
- Test both success and error cases
- Validate exit codes explicitly
- Test JSON output with `parseCliJson`
- Use descriptive test names that explain what is being tested

## Troubleshooting

### Tests timeout

Increase timeout for long-running commands:

```typescript
it("slow command", async () => {
  const result = await runCliWithTsx(["slow-command"], {
    cwd: env.cwd,
    timeout: 60000, // 60 seconds
  });
}, 60000); // Test timeout
```

### Can't find config

Ensure temp environment has config:

```typescript
const env = createTempEnv(); // Creates agent-orchestrator.yaml
```

### Tests pass locally but fail in CI

- Check for hardcoded paths
- Ensure temp directories are used
- Verify all required files are created before running CLI
