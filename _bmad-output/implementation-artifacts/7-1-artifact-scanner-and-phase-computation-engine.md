# Story 7.1: Artifact Scanner & Phase Computation Engine

Status: done

## Story

As a developer,
I want a library that scans `_bmad-output/` for artifacts, classifies them by phase using ARTIFACT_RULES, and computes phase states via downstream inference,
so that the API has a reliable computation layer to determine BMAD phase progression.

## Acceptance Criteria

1. **Given** a project directory with `_bmad-output/planning-artifacts/` containing files matching known patterns (e.g., `*prd*`, `*architecture*`)
   **When** the scanner runs against that directory
   **Then** it returns artifacts classified by phase (analysis, planning, solutioning, implementation) with filename, phase, file path, document type, and modification timestamp
   **And** unrecognized files are placed in an "uncategorized" bucket

2. **Given** classified artifacts indicate presence in solutioning phase but not analysis
   **When** phase states are computed
   **Then** analysis and planning are "done" (downstream inference), solutioning is "active", implementation is "not-started"

3. **Given** no artifacts exist in `_bmad-output/`
   **When** phase states are computed
   **Then** all four phases return "not-started"

4. **Given** artifacts exist in all four phases
   **When** phase states are computed
   **Then** analysis, planning, solutioning are "done" and implementation is "active" (implementation can never be inferred "done")

5. **Given** ARTIFACT_RULES is defined as an ordered constant with first-match-wins semantics
   **When** a filename matches multiple patterns
   **Then** only the first matching rule determines the phase classification

## Tasks / Subtasks

- [x] Task 1: Create `lib/workflow/types.ts` (AC: all)
  - [x] Define `Phase`, `PhaseState`, `ArtifactRule`, `ScannedFile`, `WorkflowResponse`, `Recommendation` types
  - [x] Export frozen `PHASES` constant array
  - [x] Match `WorkflowResponse` interface exactly per WD-4 contract
- [x] Task 2: Create `lib/workflow/artifact-rules.ts` (AC: 1, 5)
  - [x] Define `ARTIFACT_RULES` ordered constant with 9 rules
  - [x] Implement `classifyArtifact(filename: string): { phase: Phase | null; type: string }`
  - [x] Case-insensitive matching, first-match-wins
- [x] Task 3: Create `lib/workflow/scan-artifacts.ts` (AC: 1)
  - [x] Implement `scanAllArtifacts(projectRoot: string): Promise<ClassifiedArtifact[]>`
  - [x] Scan `planning-artifacts/`, `planning-artifacts/research/`, `implementation-artifacts/`
  - [x] Skip `.backup` files and non-`.md` files
  - [x] Return filename, relative path, modifiedAt (ISO 8601), phase, type
  - [x] Catch all errors silently — missing dirs return empty arrays
- [x] Task 4: Create `lib/workflow/compute-state.ts` (AC: 2, 3, 4)
  - [x] Implement `computePhaseStates(artifactsByPhase: Record<Phase, boolean>)` per WD-1 algorithm
  - [x] Downstream inference: earlier phases inferred "done" if later phase has artifacts
  - [x] Latest-active-phase selection: only ONE phase can be "active"
  - [x] Implementation never "done" via artifact detection
- [x] Task 5: Create `lib/workflow/recommendation-engine.ts` (AC: all)
  - [x] Implement `getRecommendation(artifacts, phases, phasePresence)` with 7-rule ordered chain
  - [x] R1: No artifacts → Tier 1; R2: No brief → Tier 1; R3: No PRD → Tier 1; R4: No architecture → Tier 1; R5: No epics → Tier 1; R6: Implementation active → Tier 2; R7: All complete → null
  - [x] Context voice: factual observations, no imperative verbs
  - [x] First-match-wins rule evaluation
- [x] Task 6: Create `lib/workflow/parse-agents.ts` (AC: N/A — API support)
  - [x] Implement `parseAgentManifest(csvContent: string)` with inline quoted-CSV parser
  - [x] Handle quoted fields with embedded commas (~20 lines, no external library)
  - [x] Extract: name, displayName, title, icon, role
  - [x] Skip header row and malformed rows gracefully
- [x] Task 7: Create `app/api/workflow/[project]/route.ts` (AC: all)
  - [x] GET handler orchestrating: scan → classify → compute → recommend → respond
  - [x] Access project config via `getServices()` — same pattern as sprint health route
  - [x] Return 404 for unknown project, 200 for everything else
  - [x] Detect `_bmad/` presence for `hasBmad` field
  - [x] Read agent manifest CSV if present, return `agents: null` if absent
  - [x] All file errors → graceful degradation (200 with null fields)
  - [x] Response matches frozen `WorkflowResponse` interface exactly
- [x] Task 8: Create unit tests (AC: all)
  - [x] `__tests__/compute-state.test.ts` — all 16 permutations of {true,false}^4 (27 tests)
  - [x] `__tests__/artifact-rules.test.ts` — classification edge cases, first-match-wins, unknown files (18 tests)
  - [x] `__tests__/scan-artifacts.test.ts` — real filesystem tests with temp dirs, .backup skipping, research/ recursion (15 tests)
  - [x] `__tests__/recommendation-engine.test.ts` — all 7 rules, null case, context voice validation (10 tests)
  - [x] `__tests__/parse-agents.test.ts` — quoted CSV fields, malformed rows, empty input (12 tests)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] This story does NOT use any `@composio/ao-core` interfaces directly in lib/workflow/*
- [x] API route uses `getServices()` from `@/lib/services.js` for config access only
- [x] No imports from tracker-bmad or Sprint Board code

**Methods Used:**
- [x] `getServices()` from `@/lib/services.js` — access `config.projects[projectId]` for project root
- [x] `node:fs/promises` — `readdir`, `stat`, `readFile` for file scanning
- [x] `node:path` — `join`, `relative`, `resolve` for path manipulation

**Feature Flags:**
- [x] None required — this story uses only Node builtins and existing web package patterns

## Dependency Review (if applicable)

**No new dependencies.** This story uses only:
- `node:fs/promises` — file scanning
- `node:path` — path utilities
- Existing Next.js API route patterns

Zero new entries in package.json (NFR-P6 / TS-01).

## Dev Notes

### Architecture Decisions (MUST follow)

**WD-1: Phase Computation — Downstream Inference Algorithm**
```typescript
const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;
type Phase = (typeof PHASES)[number];
type PhaseState = "not-started" | "done" | "active";

function computePhaseStates(artifactsByPhase: Record<Phase, boolean>): Array<{ id: Phase; state: PhaseState }> {
  let lastActiveIndex = -1;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (artifactsByPhase[PHASES[i]]) { lastActiveIndex = i; break; }
  }
  if (lastActiveIndex === -1) {
    return PHASES.map((id) => ({ id, state: "not-started" as PhaseState }));
  }
  return PHASES.map((id, index) => {
    if (index < lastActiveIndex) return { id, state: "done" as PhaseState };
    if (index === lastActiveIndex) return { id, state: "active" as PhaseState };
    return { id, state: "not-started" as PhaseState };
  });
}
```

Key rules:
- Downstream inference: if solutioning has artifacts but analysis doesn't, analysis is still "done"
- Only ONE phase can be "active" — the latest phase with artifacts
- Implementation can NEVER be "done" via artifact detection
- No artifacts at all → all "not-started"
- Gaps are valid (e.g., ○ ○ ★ ○ means analysis+planning inferred done)

**WD-2: ARTIFACT_RULES Constant**
```typescript
const ARTIFACT_RULES: ArtifactRule[] = [
  { pattern: "*brief*",          phase: "analysis",       type: "Product Brief" },
  { pattern: "*research*",       phase: "analysis",       type: "Research Report" },
  { pattern: "project-context*", phase: "analysis",       type: "Project Context" },
  { pattern: "*prd*",            phase: "planning",       type: "PRD" },
  { pattern: "*ux-design*",      phase: "planning",       type: "UX Design" },
  { pattern: "*ux-spec*",        phase: "planning",       type: "UX Specification" },
  { pattern: "*architecture*",   phase: "solutioning",    type: "Architecture" },
  { pattern: "*epic*",           phase: "solutioning",    type: "Epics & Stories" },
  { pattern: "*sprint*",         phase: "implementation", type: "Sprint Plan" },
];
```
- First-match-wins: `prd-architecture-comparison.md` matches `*prd*` → Planning
- Case-insensitive matching
- Files in `implementation-artifacts/` not matching any rule → `{ phase: "implementation", type: "Story Spec" }`
- Files in `planning-artifacts/` not matching → `{ phase: null, type: "Uncategorized" }`
- Skip `.backup` files and non-`.md` files

**WD-3: Recommendation Engine — 7-Rule Chain**

| Rule | Condition | Tier | Observation | Implication | Phase |
|------|-----------|------|-------------|-------------|-------|
| R1 | No artifacts at all | 1 | No BMAD artifacts detected in this project | Starting with analysis phase would establish project foundations | analysis |
| R2 | No brief artifact | 1 | No product brief found | A product brief captures core project vision and constraints | analysis |
| R3 | No PRD artifact | 1 | No PRD found | A PRD translates the brief into detailed requirements | planning |
| R4 | No architecture artifact | 1 | No architecture document found | Architecture decisions guide consistent implementation | solutioning |
| R5 | No epics artifact | 1 | No epics document found | Epics break requirements into implementable stories | solutioning |
| R6 | Implementation is active | 2 | Implementation phase is active | Sprint execution is underway | implementation |
| R7 | All phases have artifacts | — | (null) | (null) | — |

Context voice: factual observations only. No imperative verbs ("you should", "please create").

**WD-4: WorkflowResponse Interface (FROZEN after this PR)**
```typescript
interface WorkflowResponse {
  projectId: string;
  projectName: string;
  phases: Array<{
    id: string;
    label: string;
    state: "not-started" | "done" | "active";
  }>;
  agents: Array<{
    name: string;
    displayName: string;
    title: string;
    icon: string;
    role: string;
  }> | null;
  recommendation: {
    tier: 1 | 2;
    observation: string;
    implication: string;
    phase: string;
  } | null;
  artifacts: Array<{
    filename: string;
    phase: string;
    type: string;
    path: string;
    modifiedAt: string;
  }>;
  lastActivity: {
    filename: string;
    phase: string;
    modifiedAt: string;
  } | null;
}
```

**WD-8: Directories to Scan**

| Directory | Purpose |
|-----------|---------|
| `{root}/_bmad/` | Presence detection only (hasBmad) |
| `{root}/_bmad/_config/agent-manifest.csv` | Agent list |
| `{root}/_bmad-output/planning-artifacts/` | Analysis, Planning, Solutioning artifacts |
| `{root}/_bmad-output/planning-artifacts/research/` | Research subdirectory (merge into planning scan) |
| `{root}/_bmad-output/implementation-artifacts/` | Implementation artifacts |

### Import Boundary Rules (CRITICAL)

| From | Can Import | CANNOT Import |
|------|-----------|---------------|
| `lib/workflow/*` | `node:fs`, `node:path`, own sibling modules | `@composio/ao-core`, Sprint Board, tracker-bmad |
| `app/api/workflow/*/route.ts` | `lib/workflow/*`, `@/lib/services.js` (for config) | Component code, Sprint Board API routes |

The only bridge to existing system: API route reads project config via `getServices()`.

### Existing Codebase Patterns (MUST match)

**API Route Pattern** (see `app/api/sprint/[project]/health/route.ts`):
```typescript
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const { config } = await getServices();
  const project = config.projects[projectId];
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  // ... compute and return
  return NextResponse.json(result);
}
```

**Lib File Pattern:**
- One responsibility per file
- Named exports (no default exports for lib code)
- Pure functions preferred
- `.js` extension in local imports (ESM requirement)
- `type` imports for type-only: `import type { Foo } from "./types.js"`
- `node:` prefix for builtins: `import { readdir } from "node:fs/promises"`

**Test Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../my-function.js";
```
Test files in `__tests__/` subdirectory. Use helper factories for test data.

**Path Alias:** `@/*` maps to `./src/*`

**TypeScript:** Strict mode, no `any`, no unsafe casts.

### CSV Parsing (Gap WD-G2)

Agent manifest has quoted fields with commas. Simple `split(",")` breaks. Implement inline parser:
```typescript
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}
```
~20 lines, no external library. Only extract columns: name, displayName, title, icon, role.

### 81 Permutation Test Strategy

Generate all `{true, false}^4` combinations for [analysis, planning, solutioning, implementation]:
```typescript
for (let a = 0; a < 2; a++)
  for (let p = 0; p < 2; p++)
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < 2; i++) {
        const input = { analysis: !!a, planning: !!p, solutioning: !!s, implementation: !!i };
        // Assert expected output based on downstream inference rules
      }
```
16 combinations (2^4), each with 4 phases = 16 test cases covering all 81 phase-state outcomes. For each, assert the exact `[state, state, state, state]` tuple.

### 6 File States for Error Testing

1. **Normal** — Valid .md file with content
2. **Empty** — 0 bytes
3. **Truncated YAML** — Frontmatter cut mid-line
4. **Invalid frontmatter** — Bad YAML syntax
5. **Permission denied** — Unreadable file (mock `readdir`/`stat` to throw EACCES)
6. **Mid-write** — Partial content (simulate with truncated file)

Scanner must handle all 6 without throwing. Return empty results for unreadable files.

### Project Structure Notes

**New files (this story creates):**
```
packages/web/src/
├── lib/workflow/
│   ├── types.ts
│   ├── artifact-rules.ts
│   ├── scan-artifacts.ts
│   ├── compute-state.ts
│   ├── recommendation-engine.ts
│   ├── parse-agents.ts
│   └── __tests__/
│       ├── compute-state.test.ts
│       ├── artifact-rules.test.ts
│       ├── scan-artifacts.test.ts
│       ├── recommendation-engine.test.ts
│       ├── parse-agents.test.ts
│       └── fixtures/
│           ├── sample-bmad-output/
│           │   ├── planning-artifacts/
│           │   │   ├── product-brief-test.md
│           │   │   ├── prd-test.md
│           │   │   └── architecture-test.md
│           │   └── implementation-artifacts/
│           │       └── 1-1-test-story.md
│           └── agent-manifest-sample.csv
└── app/api/workflow/[project]/
    └── route.ts
```

**No existing files modified in this story.** Navigation and SSE changes come in later stories (7.4, 4.1).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — WD-1 Phase Computation]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-2 Artifact Mapping]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-3 Recommendation Engine]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-4 API Design]
- [Source: _bmad-output/planning-artifacts/architecture.md — WD-8 File Scanning]
- [Source: _bmad-output/planning-artifacts/prd-workflow-dashboard.md — FR1-FR10, FR28-FR31]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md — Epic 7, Stories 7.1-7.5]
- [Source: packages/web/src/app/api/sprint/[project]/health/route.ts — API route pattern]
- [Source: packages/web/src/lib/services.ts — getServices() singleton]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed ESLint `no-duplicate-imports` error in `compute-state.ts` — combined value and type imports into single statement
- Fixed TypeScript error in `route.ts` — `ProjectConfig.path` not `ProjectConfig.root`
- Fixed `recommendation-engine.test.ts` — adjusted context voice regex to allow gerund "Starting" (observation, not imperative)

### Completion Notes List

- All 8 tasks complete, 82 tests passing across 5 test files
- `pnpm lint` clean, `pnpm typecheck` clean
- No fixtures directory created — scan-artifacts tests use real filesystem with temp directories (more realistic than fixtures)
- Zero new dependencies added (NFR-P6 / TS-01)
- Import boundaries enforced: lib/workflow/* imports only from siblings and node: builtins

### Limitations (Deferred Items)

- No API route integration tests (covered by later stories with full Next.js test harness)
- No `__tests__/fixtures/` directory — scan-artifacts tests create temp directories at runtime instead (better isolation, no stale fixtures)

### File List

**New files created:**
- `packages/web/src/lib/workflow/types.ts` — Frozen API contract types (WD-4)
- `packages/web/src/lib/workflow/artifact-rules.ts` — ARTIFACT_RULES constant and classifyArtifact()
- `packages/web/src/lib/workflow/scan-artifacts.ts` — scanAllArtifacts() and buildPhasePresence()
- `packages/web/src/lib/workflow/compute-state.ts` — computePhaseStates() downstream inference
- `packages/web/src/lib/workflow/recommendation-engine.ts` — getRecommendation() 7-rule chain
- `packages/web/src/lib/workflow/parse-agents.ts` — parseAgentManifest() CSV parser
- `packages/web/src/app/api/workflow/[project]/route.ts` — GET /api/workflow/[project] endpoint
- `packages/web/src/lib/workflow/__tests__/compute-state.test.ts` — 27 tests (16 exhaustive permutations)
- `packages/web/src/lib/workflow/__tests__/artifact-rules.test.ts` — 18 tests
- `packages/web/src/lib/workflow/__tests__/scan-artifacts.test.ts` — 15 tests (real filesystem)
- `packages/web/src/lib/workflow/__tests__/recommendation-engine.test.ts` — 10 tests
- `packages/web/src/lib/workflow/__tests__/parse-agents.test.ts` — 12 tests

**No existing files modified.**
