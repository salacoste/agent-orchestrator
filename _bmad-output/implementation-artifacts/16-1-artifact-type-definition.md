# Story 16.1: Artifact Type Definition

Status: done

## Story

As a **developer**,
I want `Artifact` defined as a first-class typed interface in `packages/core/src/types.ts`,
So that the system can reason about BMAD artifacts programmatically across all packages (core, CLI, web, plugins).

## Acceptance Criteria

1. **AC1: Artifact interface defined in core types.ts**
   - **Given** the existing `packages/core/src/types.ts` with ~2400 lines of typed interfaces
   - **When** the Artifact types are added
   - **Then** a new `Artifact` section exists with: `ArtifactType` enum, `Phase` type, `PhaseState` type, `ArtifactRule` interface, `ScannedFile` interface, `ClassifiedArtifact` interface
   - **And** all types follow existing naming conventions (PascalCase, no `I` prefix)

2. **AC2: ArtifactType enum covers all BMAD artifact categories**
   - **Given** the BMAD workflow produces various artifact types
   - **When** `ArtifactType` is defined
   - **Then** it includes: `prd`, `architecture`, `epic`, `story`, `sprint-plan`, `review`, `retrospective`, `ux-design`, `research`, `project-context`, `brainstorming`
   - **And** uses `as const` pattern consistent with existing types (e.g., `ACTIVITY_STATE`)

3. **AC3: Phase and PhaseState types promoted to core**
   - **Given** `Phase` and `PhaseState` currently exist only in `packages/web/src/lib/workflow/types.ts`
   - **When** they are added to core types
   - **Then** `Phase = "analysis" | "planning" | "solutioning" | "implementation"` is defined in core
   - **And** `PhaseState = "not-started" | "done" | "active"` is defined in core
   - **And** `PHASES` const array is defined in core

4. **AC4: Types exported from @composio/ao-core**
   - **Given** the new types in `types.ts`
   - **When** `packages/core/src/index.ts` is updated
   - **Then** all new types are exported: `Phase`, `PhaseState`, `ArtifactType`, `ArtifactRule`, `ScannedFile`, `ClassifiedArtifact`, `PHASES`
   - **And** existing exports are unchanged

5. **AC5: Web package re-exports from core (backward compatibility)**
   - **Given** `packages/web/src/lib/workflow/types.ts` currently defines `Phase`, `PhaseState`, `ArtifactRule`, `ScannedFile`, `ClassifiedArtifact`
   - **When** these types move to core
   - **Then** web types.ts re-exports from `@composio/ao-core` instead of defining locally
   - **And** all existing imports across the web package continue to work without changes
   - **And** the `WorkflowResponse` interface (WD-4 frozen) is NOT modified

6. **AC6: All existing tests pass**
   - **Given** the type changes
   - **When** `pnpm test` runs
   - **Then** all ~2,760 existing tests pass
   - **And** `pnpm typecheck` passes with zero errors

## Tasks / Subtasks

- [x] Task 1: Define Artifact types in core/types.ts (AC: #1, #2, #3)
  - [x] 1.1: Add `Phase`, `PhaseState`, `PHASES` const to types.ts
  - [x] 1.2: Add `ArtifactType` type and `ARTIFACT_TYPES` const
  - [x] 1.3: Add `ArtifactRule` interface
  - [x] 1.4: Add `ScannedFile` interface
  - [x] 1.5: Add `ClassifiedArtifact` interface (extends ScannedFile)
  - [x] 1.6: Add JSDoc documentation following existing patterns

- [x] Task 2: Export from core/index.ts (AC: #4)
  - [x] 2.1: Types auto-exported via `export * from "./types.js"` (existing barrel)
  - [x] 2.2: Value exports (PHASES, ARTIFACT_TYPES, PHASE_LABELS) included in wildcard export

- [x] Task 3: Update web package types (AC: #5)
  - [x] 3.1: Web types.ts updated — types duplicated with "keep in sync" comment (cannot re-export from core due to Next.js bundling node:fs from core's module graph)
  - [x] 3.2: WorkflowResponse and PhaseEntry interfaces kept local (WD-4 frozen)
  - [x] 3.3: All web imports verified — 41 test files, 790 tests pass

- [x] Task 4: Validate backward compatibility (AC: #6)
  - [x] 4.1: `pnpm typecheck` — pre-existing errors only (error-logger.test.ts), no new errors from this story
  - [x] 4.2: `pnpm test` — 2,873 tests pass, 0 failures
  - [x] 4.3: `pnpm build` — all packages build successfully including Next.js

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions
- No placeholder tests
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [ ] No runtime methods — this story is TYPE DEFINITIONS ONLY
- [ ] Types must be compatible with existing `ClassifiedArtifact` usage in web package

**Feature Flags:**
- [ ] None expected — this is additive, not modifying existing behavior

## Dev Notes

### Architecture Patterns & Constraints

**CRITICAL — Follow these patterns exactly:**

1. **Type definition pattern** — Use union types with `as const`, not TypeScript `enum`:
   ```typescript
   // ✅ CORRECT — matches existing codebase pattern
   export const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;
   export type Phase = (typeof PHASES)[number];

   // ❌ WRONG — codebase does NOT use enum keyword
   export enum Phase { Analysis = "analysis", ... }
   ```

2. **Const object pattern** — For type-to-value mappings:
   ```typescript
   // ✅ CORRECT — matches ACTIVITY_STATE pattern in types.ts
   export const ARTIFACT_TYPES = {
     PRD: "prd" as const,
     ARCHITECTURE: "architecture" as const,
     // ...
   } satisfies Record<string, ArtifactType>;
   ```

3. **Interface extension pattern**:
   ```typescript
   // ✅ CORRECT — ClassifiedArtifact extends ScannedFile
   export interface ClassifiedArtifact extends ScannedFile {
     phase: Phase | null;
     type: string;
   }
   ```

4. **JSDoc pattern** — Every exported type needs documentation:
   ```typescript
   /**
    * BMAD workflow phase.
    * Artifacts are classified into one of four phases.
    */
   export type Phase = ...;
   ```

5. **ESM import requirement** — `.js` extension in all imports:
   ```typescript
   import type { Phase } from "@composio/ao-core";  // ✅ from package
   import type { Phase } from "./types.js";          // ✅ local with .js
   ```

### Source Tree Components to Touch

| File | Action | Notes |
|------|--------|-------|
| `packages/core/src/types.ts` | ADD section | New Artifact types section (~80-100 lines) |
| `packages/core/src/index.ts` | ADD exports | Export new types and consts |
| `packages/web/src/lib/workflow/types.ts` | MODIFY | Re-export from core instead of local definitions |

### What NOT to Touch

- `packages/web/src/lib/workflow/scan-artifacts.ts` — Story 16.4 handles this
- `packages/web/src/lib/workflow/artifact-rules.ts` — Keep hardcoded rules for now
- `packages/web/src/lib/workflow/compute-state.ts` — Story 16.2 handles state machine
- `WorkflowResponse` interface — Frozen (WD-4), do not modify

### Current Web Types to Migrate

These types currently live in `packages/web/src/lib/workflow/types.ts` and should be moved to core:

```typescript
// MOVE TO CORE:
export const PHASES = ["analysis", "planning", "solutioning", "implementation"] as const;
export type Phase = (typeof PHASES)[number];
export type PhaseState = "not-started" | "done" | "active";

export interface ArtifactRule {
  pattern: string;
  phase: Phase;
  type: string;
}

export interface ScannedFile {
  filename: string;
  path: string;
  modifiedAt: string;
}

export interface ClassifiedArtifact extends ScannedFile {
  phase: Phase | null;
  type: string;
}

// KEEP IN WEB (web-specific, frozen WD-4 API contract):
export interface PhaseEntry { ... }
export interface WorkflowResponse { ... }
```

### Existing Web Imports to Verify After Migration

These files import from `packages/web/src/lib/workflow/types.ts` and must continue to work:
- `scan-artifacts.ts` — imports `ScannedFile`, `ClassifiedArtifact`, `ArtifactRule`
- `compute-state.ts` — imports `Phase`, `PhaseState`, `PHASES`
- `artifact-rules.ts` — imports `ArtifactRule`, `Phase`
- `parse-agents.ts` — no artifact type imports
- `recommendation-engine.ts` — imports `Phase`, `ClassifiedArtifact`
- `route.ts` (API) — imports `WorkflowResponse`
- All `__tests__/*.test.ts` files
- All `components/Workflow*.tsx` files

### New Types to Add (Not in Web Currently)

These are NEW types that don't exist anywhere yet:

```typescript
// ArtifactType — covers all BMAD artifact categories
export type ArtifactType =
  | "prd"
  | "architecture"
  | "epic"
  | "story"
  | "sprint-plan"
  | "review"
  | "retrospective"
  | "ux-design"
  | "research"
  | "project-context"
  | "brainstorming";

// PHASE_LABELS — human-readable labels (matches existing PHASE_LABELS in web)
export const PHASE_LABELS: Record<Phase, string> = {
  analysis: "Analysis",
  planning: "Planning",
  solutioning: "Solutioning",
  implementation: "Implementation",
};
```

### Testing Standards

- No new test files needed — this is type definitions only
- Verify with `pnpm typecheck` (all packages)
- Verify with `pnpm test` (regression check)
- Verify with `pnpm lint` (type import enforcement)

### References

- [Source: packages/core/src/types.ts] — Target file, all core interfaces
- [Source: packages/core/src/index.ts] — Export barrel
- [Source: packages/web/src/lib/workflow/types.ts] — Current location of artifact types
- [Source: packages/web/src/lib/workflow/scan-artifacts.ts] — Consumer of artifact types
- [Source: packages/web/src/lib/workflow/artifact-rules.ts] — Classification rules
- [Source: packages/web/src/lib/workflow/compute-state.ts] — Phase computation
- [Source: epics-cycle-3-4.md#Epic 6a] — Epic definition and FR coverage

### Project Structure Notes

- Alignment: Types move from web→core, following existing pattern where all interfaces live in `@composio/ao-core`
- Web package re-exports to avoid breaking changes
- No new packages or directories created
- Consistent with existing brownfield extension approach

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Web re-export from core failed due to Next.js bundling node:fs via core's plugin-loader module graph
- Solution: keep types duplicated in web with "keep in sync" comment instead of cross-package import
- Pre-existing typecheck errors confirmed (error-logger.test.ts, session-learning.ts) — not introduced by this story

### Completion Notes List

- Added BMAD Workflow Artifacts section to `packages/core/src/types.ts` (~100 lines)
- Defined: Phase, PhaseState, ArtifactType, ArtifactRule, ScannedFile, ClassifiedArtifact + consts (PHASES, PHASE_LABELS, ARTIFACT_TYPES)
- Web package types updated with "duplicated from core — keep in sync" pattern
- All 2,873 tests pass, build succeeds, no regressions
- Design decision: types duplicated (not re-exported) in web due to Next.js bundler pulling node:fs from core module graph. This is a known limitation of the monorepo's barrel export pattern.

### Limitations (Deferred Items)

1. Web-core type duplication
   - Status: Accepted trade-off
   - Requires: Next.js to support selective re-exports from packages with Node.js dependencies
   - Current: Types duplicated in web with sync comment. Core is canonical.

### File List

- `packages/core/src/types.ts` — MODIFIED (added BMAD Workflow Artifacts section at end)
- `packages/web/src/lib/workflow/types.ts` — MODIFIED (added duplication comment, restructured with sync note)
- `packages/web/src/lib/workflow/__tests__/core-type-sync.test.ts` — CREATED (cross-package sync test, review finding M1/M3)
