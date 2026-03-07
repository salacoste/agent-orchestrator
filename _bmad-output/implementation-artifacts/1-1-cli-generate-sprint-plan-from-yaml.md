# Story 1.1: CLI Generate Sprint Plan from YAML

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Product Manager,
I want to generate a sprint execution plan from my sprint-status.yaml file,
so that I can see what stories are ready to be worked on and in what order.

## Acceptance Criteria

1. **Given** a valid sprint-status.yaml file exists in the project directory
   **When** I run `ao sprint-plan`
   **Then** the system parses the YAML and displays a sprint execution plan showing:
   - Total story count
   - Stories grouped by status (todo, in-progress, done)
   - Stories ordered by priority (if specified)
   - Dependency graph showing blocked stories and their prerequisites
   **And** exits with code 0 if valid, code 1 if YAML is malformed
   **And** completes within 500ms (NFR-P8)

2. **Given** the sprint-status.yaml contains stories with dependencies
   **When** I run `ao sprint-plan`
   **Then** the dependency graph shows which stories are blocked and which are ready
   **And** displays a warning if circular dependencies are detected

3. **Given** no sprint-status.yaml file exists
   **When** I run `ao sprint-plan`
   **Then** displays error message: "No sprint-status.yaml found in current directory"
   **And** exits with code 1

## Tasks / Subtasks

- [x] Create new CLI command `ao sprint-plan` in packages/cli/src/commands/
  - [x] Register command in CLI entry point
  - [x] Add command description and help text
- [x] Implement sprint-status.yaml parser
  - [x] Use existing `yaml` package (v2.7.0) from @composio/ao-core
  - [x] Validate YAML structure and required fields
  - [x] Parse development_status section
- [x] Implement status grouping logic
  - [x] Group stories by status: backlog, ready-for-dev, in-progress, review, done
  - [x] Count stories in each status
- [x] Implement priority ordering
  - [x] Sort stories by priority field if specified
  - [x] Display ordered list
- [x] Implement dependency graph visualization
  - [x] Parse story dependencies from sprint-status.yaml
  - [x] Build dependency mapping (story → prerequisites)
  - [x] Identify blocked stories (prerequisites not done)
  - [x] Display dependency graph in ASCII format
- [x] Implement circular dependency detection
  - [x] Detect cycles in dependency graph
  - [x] Display warning when cycles found
- [x] Implement error handling
  - [x] File not found error with helpful message
  - [x] YAML parse error with specific error details
  - [x] Exit with proper error codes (0 for success, 1 for errors)
- [x] Add performance optimization
  - [x] Ensure command completes within 500ms for typical sprint files
  - [x] Use streaming parser if needed for large files
- [x] Write unit tests
  - [x] Test valid sprint-status.yaml parsing
  - [x] Test missing file error handling
  - [x] Test malformed YAML error handling
  - [x] Test dependency graph accuracy
  - [x] Test circular dependency detection
  - [x] Include performance benchmarks

## Dev Notes

### Project Structure Notes

- **CLI Command Location:** `packages/cli/src/commands/sprint-plan.ts` (new file)
  - Naming: `sprint-plan` to distinguish from existing `plan` command
  - Follows existing CLI command pattern (see `plan.ts`, `status.ts`)
- **Registration:** Added to `packages/cli/src/index.ts` command registry
- **Module Type:** ESM with `.js` extension required
- **Import Pattern:** Use `node:` prefix for builtins (`node:fs`, `node:path`)

### Technical Requirements

**Technology Stack:**
- **Runtime:** Node.js ≥20.0.0
- **Language:** TypeScript 5.7.0
- **CLI Framework:** Commander.js (already in use)
- **YAML Parser:** `yaml` v2.7.0 (import from @composio/ao-core)
- **Output Formatting:** Chalk (already in use for colors)

**TypeScript Conventions (CRITICAL - MUST FOLLOW):**
- **ESM modules:** `"type": "module"` in package.json
- **`.js` extensions in imports:** `import { foo } from "./bar.js"` (REQUIRED)
- **`node:` prefix for builtins:** `import { readFileSync } from "node:fs"`
- **`type` imports:** `import type { Foo } from "./bar.js"` for type-only
- **No `any`:** Use `unknown` + type guards instead
- **Semicolons, double quotes, 2-space indent** (enforced by Prettier)

**File Structure:**
```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── sprint-plan.ts      # NEW: ao sprint-plan command
│   │   └── ...
│   ├── lib/
│   │   ├── format.ts           # Existing: header(), chalk utilities
│   │   └── resolve-project.ts   # Existing: project resolution
│   └── index.ts                # CLI entry point: register commands
```

### References

- **Epic Requirements:** [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]
- **Architecture Constraints:** [Source: _bmad-output/planning-artifacts/architecture.md]
- **Existing CLI Pattern:** [Source: packages/cli/src/commands/plan.ts]
- **TypeScript Conventions:** [Source: CLAUDE.md]
- **YAML Library:** `yaml` v2.7.0 in packages/core/package.json

### Dependency Graph Format

**ASCII Dependency Graph Example:**
```
Dependency Graph:

STORY-001: "CLI Generate Sprint Plan" [✓ done]
    ↓
STORY-002: "CLI Spawn Agent" [blocked by: STORY-001]
    ↓
STORY-003: "State Track Assignments" [blocked by: STORY-002]
    ↓
STORY-004: "CLI View Status" [ready]

⚠️  Circular dependency detected: STORY-005 ↔ STORY-006
```

**Blocked Stories Display:**
```
Blocked Stories (2):
  STORY-002 (blocked by: STORY-001, STORY-003)
  STORY-006 (blocked by: STORY-005)
```

### Testing Requirements

**Unit Tests (Vitest):**
- Test file location: `packages/cli/__tests__/commands/sprint-plan.test.ts`
- Framework: Vitest (already configured)
- Coverage target: 80%+ for new code

**Test Cases:**
1. Valid sprint-status.yaml parsing
2. Missing file error handling
3. Malformed YAML error handling
4. Status grouping (backlog, ready-for-dev, in-progress, review, done)
5. Priority ordering
6. Dependency graph accuracy
7. Circular dependency detection
8. Exit codes (0 vs 1)
9. Performance: completes within 500ms for 100-story file

**Test Data:**
- Use fixture files in `packages/cli/__tests__/fixtures/sprint-status*.yaml`
- Include valid examples with various story counts and dependency structures

### Security Considerations

- **File Input Validation:** Only read from project directory, prevent path traversal
- **YAML Safety:** Use parse() not load() to prevent code execution attacks
- **Error Messages:** Don't expose file system paths in error messages (use relative paths)

### Performance Requirements

- **NFR-P8:** CLI commands return within 500ms for non-spawning operations
- Use streaming YAML parser for large files if needed
- Cache parsed results if command run repeatedly

## Dev Agent Record

### Agent Model Used

glm-4.7 (via Claude Code)

### Debug Log References

N/A - No major debugging issues encountered

### Completion Notes List

**Implementation Summary:**
- Created `ao sprint-plan` command that reads sprint-status.yaml and displays a formatted sprint execution plan
- Implemented story grouping by status (backlog, ready-for-dev, in-progress, review, done)
- Added support for priority-based story ordering (infrastructure ready, data format extensible)
- Implemented dependency graph visualization with blocked story detection
- Implemented circular dependency detection using DFS algorithm
- Added performance monitoring with warning if exceeds 500ms target
- Created comprehensive test suite with 12 tests covering all functionality

**Key Design Decisions:**
1. Named command `sprint-plan` instead of `plan` to avoid conflict with existing BMAD `plan` command
2. Dependencies and priorities stored as optional YAML fields for future extensibility
3. Used chalk for color-coded output matching existing CLI patterns
4. Implemented proper error handling with helpful error messages and exit codes

**Testing:**
- All 12 tests pass
- TypeScript compilation successful
- Manual testing confirmed command works with real sprint-status.yaml file

### File List

**New Files:**
- packages/cli/src/commands/sprint-plan.ts
- packages/cli/__tests__/commands/sprint-plan.test.ts
- packages/cli/__tests__/fixtures/sprint-status.yaml
- packages/cli/__tests__/fixtures/sprint-status-valid.yaml
- packages/cli/__tests__/fixtures/sprint-status-with-deps.yaml

**Modified Files:**
- packages/cli/src/index.ts (added sprint-plan import and registration)
- _bmad-output/implementation-artifacts/sprint-status.yaml (fixed YAML indentation)
