# Testing Conventions

Vitest patterns and standards established across the agent-orchestrator project.

## Mock Patterns

### `vi.hoisted()` for Mock Factory Variables

ESLint's `no-duplicate-imports` conflicts with `vi.mock()` placement because `vi.mock()` is hoisted above all imports. Use `vi.hoisted()` to declare mock functions that are referenced inside `vi.mock()` factories.

```typescript
// 1. Declare mock functions with vi.hoisted() (hoisted above vi.mock)
const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(async () => []),
  mockReadFile: vi.fn(async () => "default content"),
}));

// 2. Use them in vi.mock() factory
vi.mock("node:fs/promises", () => ({
  default: { readdir: mockReaddir, readFile: mockReadFile },
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

// 3. Import the module under test AFTER all vi.mock() calls
import { myFunction } from "./my-module.js";
```

**Why this order matters:** `vi.mock()` calls are hoisted to the top of the file by Vitest. If your mock factory references a variable declared below it, that variable is `undefined` at mock time. `vi.hoisted()` ensures the variable declaration is also hoisted above `vi.mock()`.

**ESM `default` export:** When mocking Node.js built-ins like `node:fs/promises`, include both named and default exports: `{ default: { readdir, readFile }, readdir, readFile }`.

### `_resetForTesting()` for Module-Level Singletons

Module-level singletons (e.g., caches, watchers) persist state across tests. Export a `_resetForTesting()` function for test isolation:

```typescript
// Production code (e.g., lkg-cache.ts)
class WorkflowLkgCache {
  private cache = new Map();

  // ... public methods ...

  /** @internal Test-only: reset all cached state */
  _resetForTesting(): void {
    this.cache.clear();
  }
}

export const lkgCache = new WorkflowLkgCache();
```

```typescript
// Test file
import { lkgCache } from "../lkg-cache.js";

beforeEach(() => {
  vi.clearAllMocks();
  lkgCache._resetForTesting();
});
```

**Convention:** Prefix with `_` to signal internal/test-only. Call in `beforeEach`, not `afterEach`, so tests start clean even if a previous test threw.

### `describe.skipIf()` for Environment-Dependent Tests

Integration tests that require specific environments (tmux, Redis, real filesystem) use `describe.skipIf()` to skip gracefully when prerequisites are missing:

```typescript
import { existsSync } from "node:fs";

const hasBmadOutput = existsSync(
  resolve(projectRoot, "_bmad-output", "planning-artifacts"),
);

describe("integration: real _bmad/ directory", () => {
  describe.skipIf(!hasBmadOutput)("with real project artifacts", () => {
    it("discovers real BMAD artifacts", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      expect(artifacts.length).toBeGreaterThan(0);
    });
  });
});
```

**Common skip conditions:**
- `!existsSync(path)` — filesystem fixture not present
- `!tmuxOk` — tmux not installed (integration tests)
- `!canRun` — external tool not available (agent plugins)

**Why not `it.skip`:** `describe.skipIf` is conditional — tests run when the environment supports them, skip when it doesn't. `it.skip` unconditionally disables tests.

### `vi.useFakeTimers()` for Time-Dependent Tests

When testing time-dependent code (relative timestamps, debounce, timeouts), use fake timers for deterministic output:

```typescript
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

it("formats '5 minutes ago' correctly", () => {
  const fiveMinutesAgo = "2026-03-14T11:55:00Z";
  expect(formatRelativeTime(fiveMinutesAgo)).toBe("5m ago");
});
```

**Always restore real timers** in `afterEach` — fake timers affect `setTimeout`, `setInterval`, and `Date.now()` globally.

**Test boundary values:** When a function switches output format at thresholds (e.g., 60s, 60m, 24h, 7d), test both sides of each boundary.

## Test Precision Standard

### Real Assertions Only

Every test must make meaningful assertions. Never use placeholder assertions:

```typescript
// BAD — always passes regardless of behavior
expect(true).toBe(true);

// GOOD — verifies actual behavior
expect(result.artifacts).toEqual(expectedArtifacts);
expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Artifacts");
```

### Differentiate Mock States

When a function can return different states, tests must verify the _correct_ state, not just _a_ state:

```typescript
// BAD — doesn't differentiate null vs empty array
expect(data.agents).toBeFalsy();

// GOOD — tests the specific expected value
expect(data.agents).toBeNull();          // null = manifest not found
expect(data.agents).toEqual([]);         // [] = manifest found but empty
```

### Use Realistic Error Types

Mock errors should match real error types, not generic strings:

```typescript
// BAD — generic error
mockScan.mockRejectedValue(new Error("failed"));

// GOOD — realistic error matching what the real function throws
mockScan.mockRejectedValue(new Error("EACCES: permission denied"));
mockScan.mockRejectedValue(new Error("EBUSY: resource busy"));
```

### Shape Assertions

For structured return values, verify the shape, not just truthiness:

```typescript
// BAD — only checks existence
expect(result).not.toBeNull();

// GOOD — verifies structure
expect(result).not.toBeNull();
const keys = Object.keys(result!).sort();
expect(keys).toEqual(["implication", "observation", "phase", "tier"]);
expect(typeof result!.tier).toBe("number");
```

### DOM Structure Verification

For table-based components, verify column counts match:

```typescript
// After converting from list to table, count your columns:
const headers = screen.getAllByRole("columnheader");
expect(headers).toHaveLength(5);  // Name, Type, Phase, Path, Modified

const rows = screen.getAllByRole("row");
// Each row (excluding header) should have same number of cells as headers
const firstDataRow = rows[1]; // Skip header row
const cells = within(firstDataRow).getAllByRole("cell");
expect(cells).toHaveLength(5);
```

**Rule:** After any layout paradigm change (list → table, div → grid), explicitly count structural elements to verify consistency.

### Exact Assertions Over Patterns

Prefer exact value assertions over regex patterns when the value is deterministic:

```typescript
// BAD — loose pattern match
expect(text).toMatch(/\d+ ago/);

// GOOD — exact value with controlled time
vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
expect(formatRelativeTime("2026-03-14T11:55:00Z")).toBe("5m ago");
```

## Component Test Patterns

### Workflow Component Pattern

All Workflow Dashboard components follow the same structure:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("WorkflowComponentName", () => {
  describe("rendering", () => {
    // Test all data fields are rendered
    // Test multiple items render correct count
    // Test single item with all fields
  });

  describe("empty state", () => {
    // Test empty/null state message
    // Test no data elements when empty
  });

  describe("accessibility", () => {
    // Test section aria-label
    // Test h2 heading
    // Test sr-only text content
    // Test aria-hidden on decorative elements
    // Test semantic markup (table, list, etc.)
  });
});
```

**Component accessibility pattern:**
- `<section aria-label="Component name">` — region landmark
- `<h2>` heading — section identity
- `<span className="sr-only">` — descriptive text for screen readers
- `aria-hidden="true"` — on duplicate visible elements (sr-only provides the content)
- Semantic HTML: `<table>`, `<thead>`, `<th scope="col">` for tabular data

### Test Audit Before Writing Tests

Before adding tests to an existing module, audit current coverage first:

1. Read existing test file
2. List what's already tested
3. Identify gaps
4. Write only the missing tests

This prevents duplicates and keeps the test suite focused.

## Error Resilience Testing

### 30-Scenario Matrix Pattern

For systems with multiple data sources and multiple failure modes, test all combinations systematically:

```
6 file states × 5 data sources = 30 test scenarios
```

**File states:** normal, empty, truncated, invalid content, permission denied (EACCES), mid-write (EBUSY)

**Each test:**
1. Mock the specific failure for one data source
2. Call the API
3. Assert HTTP 200 (never 500 for expected file errors)
4. Assert the failed field uses LKG cache or default value
5. Assert unaffected fields are fresh (panel independence)

### Sequential Validation (LKG Cache Lifecycle)

Test the cache lifecycle with three sequential calls:

```
Call 1 (valid):   Fresh data → response correct → cache populated
Call 2 (invalid): Data source throws → response uses cache from call 1
Call 3 (valid):   Fresh NEW data → response has new data → cache updated
```

Key assertion: call 3's data must be the NEW data, not stale data from call 1.

## Architecture: Three-Layer Error Resilience (WD-7)

Dashboard features backed by file system reads should implement three layers:

| Layer | Location | Responsibility | Failure Response |
|-------|----------|----------------|-----------------|
| 1. File Reading | API route | Per-source try/catch | Return LKG or default |
| 2. API Cache | Server singleton | In-memory per-field cache | Serve cached data |
| 3. Client State | React state | Retain previous data | No error UI shown |

**Key design decisions:**
- Each data source wrapped in its own try/catch (not one outer catch) — enables panel independence
- Cache is a FALLBACK, not a primary source — every request attempts fresh reads first
- Client-side `silent=true` flag on SSE-triggered refetches — no loading skeleton, no error toasts
- HTTP 200 always — even on total failure (return empty/null defaults)

**Module-level singleton pattern for server cache:**
```typescript
export const lkgCache = new WorkflowLkgCache();
// NOT: export class ... (instantiate in each request)
```
