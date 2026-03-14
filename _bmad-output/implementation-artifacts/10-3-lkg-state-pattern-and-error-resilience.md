# Story 10.3: LKG State Pattern & Error Resilience

Status: done

## Story

As a dashboard user,
I want each panel to retain its last-known-good state when data becomes temporarily unavailable or malformed,
so that I never see error messages or broken UI during transient file system issues.

## Acceptance Criteria

1. **Given** the API cache layer
   **When** a file read fails (permission denied, mid-write lock, truncated content)
   **Then** the API returns the last-known-good cached value for that data source
   **And** no error is included in the HTTP response (still HTTP 200)

2. **Given** all 5 panels (PhaseBar, AIGuide, Agents, ArtifactInventory, LastActivity)
   **When** one panel's data source fails
   **Then** only that panel uses LKG state — all other panels render fresh data independently

3. **Given** a project where `_bmad-output/` is temporarily inaccessible (network mount disconnect)
   **When** the API is called
   **Then** it returns HTTP 200 with LKG data for all affected fields, maintaining the frozen `WorkflowResponse` shape

4. **Given** the API has no cached data (cold start) and a file read fails
   **When** the API is called
   **Then** it returns HTTP 200 with null/empty values for affected fields (never 500 for expected file errors)

5. **Given** the API has cached data
   **When** a successful fresh read occurs
   **Then** the cache is updated with the fresh data

6. **Given** the workflow-watcher detects a file change (Story 10-1)
   **When** the next API request arrives
   **Then** it reads fresh data from disk (cache does NOT prevent refresh — it's a fallback, not a primary source)

## Tasks / Subtasks

- [x] Task 1: Create LKG cache module (AC: 1, 2, 5, 6)
  - [x] 1.1 Create `packages/web/src/lib/workflow/lkg-cache.ts`
  - [x] 1.2 Implement `WorkflowLkgCache` class with per-field caching: `phases`, `agents`, `recommendation`, `artifacts`, `lastActivity`
  - [x] 1.3 `get(projectId, field)` — returns cached value or null
  - [x] 1.4 `set(projectId, field, value)` — updates cache for specific field
  - [x] 1.5 `setAll(projectId, response)` — updates all fields from a successful response
  - [x] 1.6 Export module-level singleton instance + `_resetForTesting()` function
- [x] Task 2: Wrap API data sources with try/catch + LKG fallback (AC: 1, 2, 3, 4)
  - [x] 2.1 Wrap `scanAllArtifacts()` call in try/catch — on error, use `cache.get(projectId, "artifacts")`
  - [x] 2.2 Wrap `readFile(manifestPath)` agent parsing in try/catch — already exists, ensure cache fallback
  - [x] 2.3 Wrap `buildPhasePresence` + `computePhaseStates` — on error, use `cache.get(projectId, "phases")`
  - [x] 2.4 Wrap `getRecommendation()` — on error, use `cache.get(projectId, "recommendation")`
  - [x] 2.5 On successful computation of ALL fields, call `cache.setAll(projectId, response)` before returning
  - [x] 2.6 Replace outer catch (500 error) with LKG fallback: check cache first, return cached response if available, 500 only if no cache
- [x] Task 3: Add internal error logging (AC: 1, 3)
  - [x] 3.1 Add `console.warn` for each caught file error (with file path and error type)
  - [x] 3.2 Ensure no error details leak into HTTP response body
- [x] Task 4: Write unit tests for LKG cache (AC: 1, 2, 4, 5)
  - [x] 4.1 Create `packages/web/src/lib/workflow/__tests__/lkg-cache.test.ts`
  - [x] 4.2 Test: `get()` returns null on cold start (no cached data)
  - [x] 4.3 Test: `set()` stores value, `get()` retrieves it
  - [x] 4.4 Test: `setAll()` stores all fields from WorkflowResponse
  - [x] 4.5 Test: per-field independence — setting one field doesn't affect others
  - [x] 4.6 Test: per-project isolation — different projects have separate caches
  - [x] 4.7 Test: `_resetForTesting()` clears all cached data
- [x] Task 5: Write integration tests for API route LKG behavior (AC: 1, 2, 3, 4, 6)
  - [x] 5.1 Create `packages/web/src/app/api/workflow/[project]/route-lkg.test.ts`
  - [x] 5.2 Test: successful response populates LKG cache
  - [x] 5.3 Test: artifact scan failure returns cached artifacts + fresh other fields
  - [x] 5.4 Test: agent manifest failure returns cached agents + fresh other fields (AC2 independence)
  - [x] 5.5 Test: total computation failure with cache → returns HTTP 200 with cached response
  - [x] 5.6 Test: total computation failure without cache → returns HTTP 200 with null/empty fields (AC4)
  - [x] 5.7 Test: successful request after failure updates cache with fresh data (AC5)
- [x] Task 6: Lint, typecheck, verify (all ACs)
  - [x] 6.1 Run `pnpm lint` — clean (0 errors, 1 pre-existing warning)
  - [x] 6.2 Run `pnpm typecheck` — clean
  - [x] 6.3 Run `pnpm test` — all 496 tests pass (28 route tests: 20 existing + 8 new LKG)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [x] No core interface methods used — this story is entirely within `packages/web`
- [x] No feature flags needed — uses only Node.js built-in APIs and existing imports

**Methods Used:**
- [x] `readdir`, `readFile`, `stat` — Node.js built-ins, already used in route.ts and scan-artifacts.ts
- [x] `Map` — JavaScript built-in for in-memory caching

**Feature Flags:**
- None required

## Dependency Review (if applicable)

**No new dependencies required.** This story uses only:
- Node.js built-in `node:fs/promises` (already imported)
- JavaScript `Map` for in-memory caching
- Existing workflow utility functions (`scanAllArtifacts`, `computePhaseStates`, `getRecommendation`, `parseAgentManifest`)

## Dev Notes

### Critical Architecture Decisions

**WD-7 (LKG State Pattern — Three Layers):** This story implements Layers 1 and 2. Layer 3 (client-side) was already implemented in Story 10-2.

| Layer | Responsibility | Story |
|-------|---------------|-------|
| Layer 1 — File Reading | Try/catch around each data source, return null on error | **10-3 (this story)** |
| Layer 2 — API Cache | In-memory per-project cache, serve cached data on error | **10-3 (this story)** |
| Layer 3 — Client State | React state retention on fetch failure, no error UI | 10-2 (done) |

**WD-4 (Frozen API Contract):** The `WorkflowResponse` interface is FROZEN. Do NOT modify it. The LKG cache stores and returns complete `WorkflowResponse` objects. All responses must maintain this exact shape.

**WD-6 (Panel Independence — AC2):** Each panel's data source is cached INDEPENDENTLY. When `scanAllArtifacts()` fails but `parseAgentManifest()` succeeds, the response contains cached artifacts + fresh agents. This requires wrapping each data source in its own try/catch rather than one outer catch.

### Implementation Guide

#### File: `packages/web/src/lib/workflow/lkg-cache.ts` (NEW)

```typescript
import type { WorkflowResponse } from "./types.js";

/**
 * Per-field LKG cache keys — matches WorkflowResponse fields that can fail independently.
 */
type CacheField = "phases" | "agents" | "recommendation" | "artifacts" | "lastActivity";

/**
 * In-memory LKG (Last-Known-Good) cache for workflow data.
 * Stores per-project, per-field cached values so that individual
 * data source failures don't cascade to other panels (WD-7, AC2).
 */
class WorkflowLkgCache {
  private cache = new Map<string, Map<CacheField, unknown>>();

  get<T>(projectId: string, field: CacheField): T | null {
    return (this.cache.get(projectId)?.get(field) as T) ?? null;
  }

  set(projectId: string, field: CacheField, value: unknown): void {
    if (!this.cache.has(projectId)) {
      this.cache.set(projectId, new Map());
    }
    this.cache.get(projectId)!.set(field, value);
  }

  setAll(projectId: string, response: WorkflowResponse): void {
    const fields: Map<CacheField, unknown> = new Map();
    fields.set("phases", response.phases);
    fields.set("agents", response.agents);
    fields.set("recommendation", response.recommendation);
    fields.set("artifacts", response.artifacts);
    fields.set("lastActivity", response.lastActivity);
    this.cache.set(projectId, fields);
  }

  /** Build a full WorkflowResponse from cached fields. Returns null if no cache for project. */
  getFullResponse(projectId: string, projectName: string): WorkflowResponse | null {
    const fields = this.cache.get(projectId);
    if (!fields) return null;
    return {
      projectId,
      projectName,
      hasBmad: true, // We only cache when hasBmad=true
      phases: (fields.get("phases") as WorkflowResponse["phases"]) ?? [],
      agents: (fields.get("agents") as WorkflowResponse["agents"]) ?? null,
      recommendation: (fields.get("recommendation") as WorkflowResponse["recommendation"]) ?? null,
      artifacts: (fields.get("artifacts") as WorkflowResponse["artifacts"]) ?? [],
      lastActivity: (fields.get("lastActivity") as WorkflowResponse["lastActivity"]) ?? null,
    };
  }

  /** @internal Test-only: reset all cached state */
  _resetForTesting(): void {
    this.cache.clear();
  }
}

/** Module-level singleton (WD-7 Layer 2) */
export const lkgCache = new WorkflowLkgCache();
```

**Key design decisions:**
1. **Per-field caching** (not per-response): Enables AC2 panel independence. When artifacts fail but agents succeed, we return cached artifacts + fresh agents.
2. **Module-level singleton**: Same pattern as `workflow-watcher.ts` (Story 10-1). Persists across requests within the same server process.
3. **`_resetForTesting()`**: Enables test isolation without `vi.resetModules()`.
4. **`getFullResponse()`**: Convenience method for the outer catch — builds a complete `WorkflowResponse` from cached fields.

#### File: `packages/web/src/app/api/workflow/[project]/route.ts` (MODIFY)

**Current structure** (lines 37-125): Single try/catch around ALL data sources. Any failure → 500.

**Required refactoring:** Wrap EACH data source independently, with LKG fallback per source.

```typescript
// ADD import at top:
import { lkgCache } from "@/lib/workflow/lkg-cache.js";

// REFACTOR the hasBmad=true branch (lines 77-119):

// --- Artifacts (independent try/catch) ---
let artifacts: WorkflowResponse["artifacts"] = [];
try {
  artifacts = await scanAllArtifacts(projectRoot);
} catch (err) {
  console.warn(`[workflow-api] artifact scan failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
  artifacts = lkgCache.get(projectId, "artifacts") ?? [];
}

// --- Phases (depends on artifacts, but computation can fail) ---
let phases: WorkflowResponse["phases"];
try {
  const phasePresence = buildPhasePresence(artifacts);
  phases = computePhaseStates(phasePresence);
} catch (err) {
  console.warn(`[workflow-api] phase computation failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
  phases = lkgCache.get(projectId, "phases") ?? computePhaseStates({
    analysis: false, planning: false, solutioning: false, implementation: false,
  });
}

// --- Recommendation (depends on artifacts + phases, can fail) ---
let recommendation: WorkflowResponse["recommendation"] = null;
try {
  const phasePresence = buildPhasePresence(artifacts);
  recommendation = getRecommendation(artifacts, phases, phasePresence);
} catch (err) {
  console.warn(`[workflow-api] recommendation failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
  recommendation = lkgCache.get(projectId, "recommendation") ?? null;
}

// --- Agents (independent — already has try/catch, add cache fallback) ---
let agents: WorkflowResponse["agents"] = null;
try {
  const csvContent = await readFile(manifestPath, "utf-8");
  const parsed = parseAgentManifest(csvContent);
  if (parsed.length > 0) agents = parsed;
} catch {
  agents = lkgCache.get(projectId, "agents") ?? null;
}

// --- LastActivity (derived from artifacts, can't fail independently) ---
const latestPhased = artifacts.find((a) => a.phase !== null);
const lastActivity = latestPhased && latestPhased.phase !== null
  ? { filename: latestPhased.filename, phase: latestPhased.phase, modifiedAt: latestPhased.modifiedAt }
  : null;

// Build response and update cache
const response: WorkflowResponse = {
  projectId,
  projectName: project.name ?? projectId,
  hasBmad: true,
  phases, agents, recommendation, artifacts, lastActivity,
};
lkgCache.setAll(projectId, response);
return NextResponse.json(response);
```

**Outer catch modification (AC3, AC4):**
```typescript
catch (error) {
  // Check LKG cache before returning 500
  const cached = lkgCache.getFullResponse(projectId, project?.name ?? projectId);
  if (cached) {
    console.warn(`[workflow-api] returning LKG cache for ${projectId}: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(cached);
  }
  // No cache — return empty response rather than 500 for file errors (AC4)
  console.warn(`[workflow-api] no cache available for ${projectId}: ${error instanceof Error ? error.message : String(error)}`);
  const emptyResponse: WorkflowResponse = {
    projectId,
    projectName: projectId,
    hasBmad: true,
    phases: computePhaseStates({ analysis: false, planning: false, solutioning: false, implementation: false }),
    agents: null, recommendation: null, artifacts: [], lastActivity: null,
  };
  return NextResponse.json(emptyResponse);
}
```

**CRITICAL: The cache is a FALLBACK, not a primary source (AC6).** Every request ALWAYS attempts fresh reads from disk first. The cache is only used when a read fails. The workflow-watcher (Story 10-1) triggers SSE events that cause the client to re-fetch, which reads fresh data. The cache does NOT short-circuit fresh reads.

### Error Handling Coverage (6 File States)

| File State | What Happens | API Behavior |
|-----------|-------------|-------------|
| Normal | Read succeeds | Return fresh data, update cache |
| Empty file | Existing code returns empty arrays | Return results, update cache |
| Truncated YAML | `parseAgentManifest` throws | Return cached agents, fresh everything else |
| Invalid frontmatter | Artifact scan may skip file | Return what's parseable, rest from cache |
| Permission denied (EACCES) | `readdir`/`readFile` throws | Return cached data for that source |
| Mid-write (EBUSY) | `readFile` throws | Return cached data for that source |

### Previous Story Learnings (Story 10-2)

- **`silent` fetch pattern**: Story 10-2 established the client-side LKG pattern — SSE-triggered refetches use `silent=true` to avoid showing loading/error states. Story 10-3 complements this at the server level.
- **Code review caught M1 bug**: `setLoading(false)` was only called in non-silent path, causing stuck loading state. Always consider both code paths.
- **Module-level singleton pattern**: Used in `workflow-watcher.ts` (Story 10-1). Follow same pattern for LKG cache.
- **`_resetForTesting()` export**: Required for test isolation of module-level state.
- **Test patterns**: Mock file system operations, verify per-field independence.

### Testing Strategy

**Unit tests for `lkg-cache.ts`:**
- Cold start: `get()` returns null
- Set/get round-trip
- `setAll()` populates all fields
- Per-field independence
- Per-project isolation
- `_resetForTesting()` clears everything

**Integration tests for route.ts LKG behavior:**
- Mock `scanAllArtifacts` to throw → verify cached artifacts returned
- Mock `readFile` (agent manifest) to throw → verify cached agents returned
- Mock ALL data sources to fail + cache exists → verify HTTP 200 with cached response
- Mock ALL data sources to fail + no cache → verify HTTP 200 with empty/null response
- Verify successful request updates cache
- Verify per-field independence: artifact failure doesn't affect agent freshness

**Note:** The comprehensive 30-scenario matrix test is deferred to Story 10-4. This story tests the cache mechanism and per-source fallback.

### Limitations (Deferred Items)

1. 30-Scenario Matrix Testing
   - Status: Deferred to Story 10-4
   - Requires: All 6 file states × 5 panels exhaustive testing
   - Current: Story 10-3 tests cache mechanism + per-source fallback
   - Story 10-4 will add comprehensive matrix coverage

2. Cache TTL / Size Limits
   - Status: Not needed for current architecture
   - Requires: If projects grow very large or server runs indefinitely
   - Current: Cache grows unbounded per project. Since this is a dev tool with few projects, memory is not a concern.

### Cross-Story Context

**Story 10-1 (done):** File watcher → SSE dispatch. Triggers cache invalidation indirectly (client re-fetches, which reads fresh data).
**Story 10-2 (done):** Client-side SSE subscription + LKG (Layer 3). Retains React state on fetch failure.
**Story 10-3 (this):** Server-side LKG cache (Layers 1 & 2). Per-source try/catch + in-memory fallback.
**Story 10-4 (next):** Comprehensive error resilience tests — 30-scenario matrix validation.

### Project Structure Notes

- All new files go in `packages/web/src/lib/workflow/` (LKG cache)
- ESM imports with `.js` extensions required
- `type` keyword for type-only imports
- Strict TypeScript mode, no `any`
- File naming: `kebab-case.ts`
- Module-level singleton with `_resetForTesting()` for test isolation

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WD-7 LKG State Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-4 API Design & Contract]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-6 Component Architecture]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md#Epic 4 Story 3]
- [Source: packages/web/src/app/api/workflow/[project]/route.ts — current API route (no LKG)]
- [Source: packages/web/src/lib/workflow/types.ts — frozen WorkflowResponse interface]
- [Source: packages/web/src/lib/workflow/scan-artifacts.ts — artifact scanner]
- [Source: packages/web/src/lib/workflow/compute-state.ts — phase computation]
- [Source: packages/web/src/lib/workflow/recommendation-engine.ts — recommendation logic]
- [Source: packages/web/src/lib/workflow/parse-agents.ts — agent manifest parser]
- [Source: packages/web/src/lib/workflow-watcher.ts — file watcher singleton (Story 10-1)]
- [Source: packages/web/src/components/WorkflowPage.tsx — client LKG pattern (Story 10-2)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Created per-project, per-field LKG cache module (lkg-cache.ts) with module-level singleton pattern
- Refactored route.ts from single outer try/catch to per-source independent try/catch blocks with LKG fallback
- Each data source (artifacts, phases, recommendation, agents) fails independently — AC2 panel independence
- Outer catch now returns LKG cached response (AC3) or empty response (AC4) instead of HTTP 500
- Hoisted `projectId` and `project` declarations above try block to ensure scope availability in catch
- Added `console.warn` logging for all caught errors with `[workflow-api]` prefix — no error details leak to HTTP response
- Updated 2 existing route tests that expected HTTP 500 → now expect HTTP 200 with empty response per AC4
- Added `lkgCache._resetForTesting()` to existing test's `beforeEach` for proper isolation
- 8 unit tests for lkg-cache.ts, 8 integration tests for route LKG behavior — all passing
- Full suite: 496 tests pass, lint clean (0 errors), typecheck clean
- **Code review fixes (3 MEDIUM, 1 LOW):**
  - M1: Deduplicated `buildPhasePresence()` call — computed once, shared between phases and recommendation
  - M2: Changed `project` type from inline `{ name?: string; path?: string }` to `ProjectConfig` import from `@composio/ao-core`
  - M3: Changed outer catch cold-start response from `hasBmad: true` to `hasBmad: false` (accurate — BMAD state unknown)
  - L1: Added `console.warn` logging to agents catch block (was silently swallowing errors)

### File List

- `packages/web/src/lib/workflow/lkg-cache.ts` — NEW: Per-field LKG cache module (WD-7 Layer 2)
- `packages/web/src/lib/workflow/__tests__/lkg-cache.test.ts` — NEW: 8 unit tests for LKG cache
- `packages/web/src/app/api/workflow/[project]/route.ts` — MODIFIED: Per-source try/catch + LKG fallback
- `packages/web/src/app/api/workflow/[project]/route.test.ts` — MODIFIED: Updated 2 tests for new LKG behavior, added cache reset
- `packages/web/src/app/api/workflow/[project]/route-lkg.test.ts` — NEW: 8 integration tests for LKG behavior
