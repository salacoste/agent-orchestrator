# Story 41.3: GitHub Action — CI Workflow Testing

Status: done

## Story

As a CI/CD user running the GitHub Action,
I want the action's spawn/status/recommend commands to be tested,
so that I can trust the action works correctly before using it in workflows.

## Acceptance Criteria

1. Unit tests verify all 3 commands (spawn, status, recommend) with mocked fetch
2. Tests verify error handling (unknown command, missing story-id, API failures)
3. Action.yml validates correctly (required fields present)
4. A sample GitHub Actions workflow file documents usage
5. Package has a working test script

## Tasks / Subtasks

- [ ] Task 1: Add test infrastructure to github-action package (AC: #5)
  - [ ] 1.1: Add vitest + package.json test script
  - [ ] 1.2: Add tsconfig for the package if missing
- [ ] Task 2: Write unit tests for run() function (AC: #1, #2)
  - [ ] 2.1: Test spawn command calls correct endpoint and sets output
  - [ ] 2.2: Test status command calls workflow API and sets output
  - [ ] 2.3: Test recommend command calls workflow API and sets output
  - [ ] 2.4: Test unknown command calls setFailed
  - [ ] 2.5: Test spawn without story-id calls setFailed
  - [ ] 2.6: Test API failure calls setFailed
- [ ] Task 3: Validate action.yml and create sample workflow (AC: #3, #4)
  - [ ] 3.1: Test action.yml has required fields (name, inputs, outputs, runs)
  - [ ] 3.2: Create `.github/workflows/ao-example.yml` sample workflow

## Dev Notes

### Architecture Constraints

- **`run()` function** — accepts `ActionCore` interface, uses `fetch` for API calls
- **No `@actions/core` dependency** — uses custom `ActionCore` interface for testability
- **Node 20** — action.yml specifies `using: "node20"`

### Files to Create/Modify

1. `packages/github-action/package.json` (new — add vitest + scripts)
2. `packages/github-action/tsconfig.json` (new — TypeScript config)
3. `packages/github-action/src/index.test.ts` (new — unit tests)
4. `.github/workflows/ao-example.yml` (new — sample workflow)

### References

- [Source: packages/github-action/src/index.ts] — action implementation
- [Source: packages/github-action/action.yml] — action manifest

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
